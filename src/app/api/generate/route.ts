import { NextResponse } from 'next/server';
import {
  buildReferenceContextBlocks,
  retrieveTaskReferencesFromUnderstanding,
  selectTaskReferences,
  startStrategyStream,
  understandTask,
  type ReferenceMode,
  type TaskInput,
  type TaskReferencesSelection,
} from '@/agents/strategy';
import {
  parseGenerationOutput,
  startGenerationTextStream,
  type GenerationOutput,
} from '@/agents/generation';
import type { StrategyResult } from '@/agents/schemas/strategy';
import { GenerationLifecycleTracker, type GenerationStep } from '@/lib/generation-lifecycle';
import { logger } from '@/lib/logger';
import { formatSseEvent } from '@/lib/sse';
import {
  createTask,
  saveTaskOutputs,
  saveTaskReferences,
  saveTaskStrategy,
  type UpdateTaskPatch,
  updateTask,
} from './repository';

export const dynamic = 'force-dynamic';

export interface GeneratePostDependencies {
  createTask: (input: TaskInput) => Promise<{ id: string }>;
  updateTask: (taskId: string, patch: UpdateTaskPatch) => Promise<void>;
  saveTaskReferences: (taskId: string, selection: TaskReferencesSelection) => Promise<void>;
  saveTaskStrategy: (taskId: string, strategy: StrategyResult) => Promise<void>;
  saveTaskOutputs: (taskId: string, outputs: GenerationOutput) => Promise<void>;
  understandTask: (
    input: TaskInput,
    abortSignal?: AbortSignal,
  ) => Promise<Awaited<ReturnType<typeof understandTask>>>;
  retrieveTaskReferencesFromUnderstanding: (
    taskUnderstanding: Awaited<ReturnType<typeof understandTask>>,
    abortSignal?: AbortSignal,
  ) => Promise<Awaited<ReturnType<typeof retrieveTaskReferencesFromUnderstanding>>>;
  startStrategyStream: (input: {
    taskInput: TaskInput;
    taskUnderstanding: Awaited<ReturnType<typeof understandTask>>;
    referenceSelection: TaskReferencesSelection;
    referenceBlocks: ReturnType<typeof buildReferenceContextBlocks>;
    abortSignal?: AbortSignal;
  }) => Promise<ReturnType<typeof startStrategyStream>>;
  startGenerationStream: (input: {
    taskInput: TaskInput;
    strategy: StrategyResult;
    referenceMode: ReferenceMode;
    referenceBlocks: Array<{ referenceType: 'title' | 'structure' | 'visual' | 'tone'; promptBlock: string }>;
    abortSignal?: AbortSignal;
  }) => Promise<ReturnType<typeof startGenerationTextStream>>;
}

function createDefaultGeneratePostDependencies(): GeneratePostDependencies {
  return {
    createTask,
    updateTask,
    saveTaskReferences,
    saveTaskStrategy,
    saveTaskOutputs,
    understandTask: (input, abortSignal) => understandTask(input, undefined, abortSignal),
    retrieveTaskReferencesFromUnderstanding: (taskUnderstanding, abortSignal) =>
      retrieveTaskReferencesFromUnderstanding(taskUnderstanding, undefined, {}, abortSignal),
    startStrategyStream: async (input) => startStrategyStream(
      {
        taskInput: input.taskInput,
        taskUnderstanding: input.taskUnderstanding,
        referenceSelection: input.referenceSelection,
        referenceBlocks: input.referenceBlocks,
      },
      undefined,
      input.abortSignal,
    ),
    startGenerationStream: async (input) =>
      startGenerationTextStream({
        taskInput: input.taskInput,
        strategy: input.strategy,
        referenceMode: input.referenceMode,
        referenceBlocks: input.referenceBlocks,
      }, undefined, input.abortSignal),
  };
}

function normalizeTaskInput(body: Partial<TaskInput>): TaskInput | null {
  const topic = body.topic?.trim();
  if (!topic) {
    return null;
  }

  return {
    topic,
    targetAudience: body.targetAudience?.trim() || undefined,
    goal: body.goal?.trim() || undefined,
    stylePreference: body.stylePreference?.trim() || undefined,
    personaMode: body.personaMode?.trim() || undefined,
    styleProfileId: body.styleProfileId?.trim() || undefined,
    needCoverSuggestion: body.needCoverSuggestion,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function createGeneratePostHandler(
  dependencies: GeneratePostDependencies = createDefaultGeneratePostDependencies(),
) {
  return async function POST(request: Request) {
    try {
      const body = (await request.json()) as Partial<TaskInput>;
      const taskInput = normalizeTaskInput(body);

      if (!taskInput) {
        return NextResponse.json({ error: 'topic is required' }, { status: 400 });
      }

      const task = await dependencies.createTask(taskInput);
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: unknown) => {
            controller.enqueue(encoder.encode(formatSseEvent(event, data)));
          };

          let currentStep: GenerationStep = 'understanding';
          let referenceMode: ReferenceMode | undefined;
          const startedAt = new Date().toISOString();
          const lifecycle = new GenerationLifecycleTracker({
            currentStep,
            now: startedAt,
          });
          let currentAbortController: AbortController | null = null;
          let heartbeatInFlight = false;

          const syncTaskRuntime = async () => {
            const snapshot = lifecycle.snapshot;
            await dependencies.updateTask(task.id, {
              status: snapshot.lifecycle_state,
              currentStep: snapshot.current_step,
              startedAt: snapshot.started_at,
              lastProgressAt: snapshot.last_progress_at,
              lastHeartbeatAt: snapshot.last_heartbeat_at,
              stalledAt: snapshot.stalled_at,
              failedAt: snapshot.failed_at,
              stalledReason: snapshot.stalled_reason,
              failureReason: snapshot.failure_reason,
              referenceMode,
            });
          };

          const sendLifecycle = () => {
            sendEvent('lifecycle', {
              task_id: task.id,
              ...lifecycle.snapshot,
            });
          };

          const recordProgress = async (step: GenerationStep, now = new Date().toISOString()) => {
            const previousState = lifecycle.snapshot.lifecycle_state;
            lifecycle.recordProgress({
              currentStep: step,
              now,
            });
            await syncTaskRuntime();
            if (previousState === 'stalled') {
              sendLifecycle();
            }
          };

          const failTask = async (reason: string, now = new Date().toISOString()) => {
            if (lifecycle.snapshot.lifecycle_state !== 'failed') {
              lifecycle.fail(now, reason);
              await syncTaskRuntime();
              sendLifecycle();
            }
          };

          const heartbeatTimer = setInterval(() => {
            if (heartbeatInFlight) {
              return;
            }

            heartbeatInFlight = true;
            void (async () => {
              try {
                const now = new Date().toISOString();
                lifecycle.recordHeartbeat(now);
                const evaluation = lifecycle.evaluate(now);
                await syncTaskRuntime();
                sendLifecycle();

                if (evaluation.shouldAbort && currentAbortController && !currentAbortController.signal.aborted) {
                  currentAbortController.abort(new Error(
                    evaluation.snapshot.failure_reason ?? 'Generation aborted.',
                  ));
                }
              } finally {
                heartbeatInFlight = false;
              }
            })();
          }, 5_000);

          try {
            sendEvent('task_created', { task_id: task.id });
            await syncTaskRuntime();
            sendLifecycle();
            sendEvent('status', {
              step: 'understanding',
              message: '开始任务理解',
            });
            currentAbortController = new AbortController();
            const taskUnderstanding = await dependencies.understandTask(
              taskInput,
              currentAbortController.signal,
            );
            currentAbortController = null;
            await recordProgress('understanding');
            sendEvent('task_understanding', taskUnderstanding);

            currentStep = 'searching';
            sendEvent('status', {
              step: 'searching',
              message: '开始检索参考样本',
            });
            await recordProgress('searching');
            currentAbortController = new AbortController();
            const retrieval = await dependencies.retrieveTaskReferencesFromUnderstanding(
              taskUnderstanding,
              currentAbortController.signal,
            );
            currentAbortController = null;
            const referenceSelection = selectTaskReferences(
              retrieval.similarSamples,
              retrieval.taskUnderstanding,
              retrieval.referenceMode,
            );
            referenceMode = referenceSelection.reference_mode;
            await dependencies.saveTaskReferences(task.id, referenceSelection);
            await recordProgress('searching');
            sendEvent('references', {
              ...referenceSelection,
              search_mode: retrieval.searchMode,
              search_mode_reason: retrieval.searchModeReason,
            });

            const referenceBlocks = buildReferenceContextBlocks(
              referenceSelection.selected_references,
              retrieval.similarSamples,
            );

            currentStep = 'strategizing';
            sendEvent('status', {
              step: 'strategizing',
              message: '开始生成策略',
            });
            await recordProgress('strategizing');
            currentAbortController = new AbortController();
            const strategyStream = await dependencies.startStrategyStream({
              taskInput,
              taskUnderstanding: retrieval.taskUnderstanding,
              referenceSelection,
              referenceBlocks,
              abortSignal: currentAbortController.signal,
            });

            let lastStrategySnapshot = '';
            sendEvent('status', {
              step: 'strategizing',
              message: '等待最终策略定稿',
            });
            for await (const partial of strategyStream.partialObjectStream) {
              if (partial && Object.keys(partial).length > 0) {
                await recordProgress('strategizing');
                lastStrategySnapshot = JSON.stringify(partial);
                sendEvent('strategy_snapshot', partial);
              }
            }

            const strategy = await strategyStream.object as unknown as StrategyResult;
            currentAbortController = null;
            if (JSON.stringify(strategy) !== lastStrategySnapshot) {
              await recordProgress('strategizing');
              sendEvent('strategy_snapshot', strategy);
            }
            await dependencies.saveTaskStrategy(task.id, strategy);
            await recordProgress('strategizing');

            currentStep = 'generating';
            sendEvent('status', {
              step: 'generating',
              message: '开始生成正文',
            });
            await recordProgress('generating');
            currentAbortController = new AbortController();
            const generationStream = await dependencies.startGenerationStream({
              taskInput,
              strategy,
              referenceMode: referenceSelection.reference_mode,
              referenceBlocks: referenceBlocks.map((block) => ({
                referenceType: block.reference_type,
                promptBlock: block.promptBlock,
              })),
              abortSignal: currentAbortController.signal,
            });

            let fullText = '';
            for await (const chunk of generationStream.textStream) {
              fullText += chunk;
              lifecycle.recordProgress({
                currentStep: 'generating',
                now: new Date().toISOString(),
              });
              await syncTaskRuntime();
              sendEvent('generation_delta', { text: chunk });
            }
            currentAbortController = null;

            currentStep = 'persisting';
            sendEvent('status', {
              step: 'persisting',
              message: '正在整理结构化结果',
            });
            await recordProgress('persisting');
            const parsed = parseGenerationOutput(fullText);
            await dependencies.saveTaskOutputs(task.id, parsed);
            lifecycle.complete(new Date().toISOString());
            await syncTaskRuntime();
            sendLifecycle();
            sendEvent('generation_complete', parsed);
            sendEvent('done', { task_id: task.id });
          } catch (error) {
            await failTask(
              lifecycle.snapshot.failure_reason ?? getErrorMessage(error),
            );
            sendEvent('error', {
              message: lifecycle.snapshot.failure_reason ?? getErrorMessage(error),
              step: currentStep,
            });
          } finally {
            clearInterval(heartbeatTimer);
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to start generation task');
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

export const POST = createGeneratePostHandler();
