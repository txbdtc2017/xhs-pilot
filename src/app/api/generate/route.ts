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
import { logger } from '@/lib/logger';
import { formatSseEvent } from '@/lib/sse';
import {
  createTask,
  saveTaskOutputs,
  saveTaskReferences,
  saveTaskStrategy,
  updateTask,
} from './repository';

export const dynamic = 'force-dynamic';

type GenerationStep = 'understanding' | 'searching' | 'strategizing' | 'generating' | 'persisting';

export interface GeneratePostDependencies {
  createTask: (input: TaskInput) => Promise<{ id: string }>;
  updateTask: (
    taskId: string,
    patch: { status: string; referenceMode?: string },
  ) => Promise<void>;
  saveTaskReferences: (taskId: string, selection: TaskReferencesSelection) => Promise<void>;
  saveTaskStrategy: (taskId: string, strategy: StrategyResult) => Promise<void>;
  saveTaskOutputs: (taskId: string, outputs: GenerationOutput) => Promise<void>;
  understandTask: (input: TaskInput) => Promise<Awaited<ReturnType<typeof understandTask>>>;
  retrieveTaskReferencesFromUnderstanding: (
    taskUnderstanding: Awaited<ReturnType<typeof understandTask>>,
  ) => Promise<Awaited<ReturnType<typeof retrieveTaskReferencesFromUnderstanding>>>;
  startStrategyStream: (input: {
    taskInput: TaskInput;
    taskUnderstanding: Awaited<ReturnType<typeof understandTask>>;
    referenceSelection: TaskReferencesSelection;
    referenceBlocks: ReturnType<typeof buildReferenceContextBlocks>;
  }) => Promise<ReturnType<typeof startStrategyStream>>;
  startGenerationStream: (input: {
    taskInput: TaskInput;
    strategy: StrategyResult;
    referenceMode: ReferenceMode;
    referenceBlocks: Array<{ referenceType: 'title' | 'structure' | 'visual' | 'tone'; promptBlock: string }>;
  }) => Promise<ReturnType<typeof startGenerationTextStream>>;
}

function createDefaultGeneratePostDependencies(): GeneratePostDependencies {
  return {
    createTask,
    updateTask,
    saveTaskReferences,
    saveTaskStrategy,
    saveTaskOutputs,
    understandTask,
    retrieveTaskReferencesFromUnderstanding: (taskUnderstanding) =>
      retrieveTaskReferencesFromUnderstanding(taskUnderstanding),
    startStrategyStream: async (input) => startStrategyStream(input),
    startGenerationStream: async (input) =>
      startGenerationTextStream({
        taskInput: input.taskInput,
        strategy: input.strategy,
        referenceMode: input.referenceMode,
        referenceBlocks: input.referenceBlocks,
      }),
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

          try {
            await dependencies.updateTask(task.id, { status: 'understanding' });
            const taskUnderstanding = await dependencies.understandTask(taskInput);
            sendEvent('task_understanding', taskUnderstanding);

            currentStep = 'searching';
            await dependencies.updateTask(task.id, { status: 'searching' });
            const retrieval = await dependencies.retrieveTaskReferencesFromUnderstanding(taskUnderstanding);
            const referenceSelection = selectTaskReferences(
              retrieval.similarSamples,
              retrieval.taskUnderstanding,
              retrieval.referenceMode,
            );
            await dependencies.saveTaskReferences(task.id, referenceSelection);
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
            await dependencies.updateTask(task.id, { status: 'strategizing' });
            const strategyStream = await dependencies.startStrategyStream({
              taskInput,
              taskUnderstanding: retrieval.taskUnderstanding,
              referenceSelection,
              referenceBlocks,
            });

            let lastStrategySnapshot = '';
            for await (const partial of strategyStream.partialObjectStream) {
              if (partial && Object.keys(partial).length > 0) {
                lastStrategySnapshot = JSON.stringify(partial);
                sendEvent('strategy_snapshot', partial);
              }
            }

            currentStep = 'persisting';
            const strategy = await strategyStream.object as unknown as StrategyResult;
            if (JSON.stringify(strategy) !== lastStrategySnapshot) {
              sendEvent('strategy_snapshot', strategy);
            }
            await dependencies.saveTaskStrategy(task.id, strategy);

            currentStep = 'generating';
            await dependencies.updateTask(task.id, { status: 'generating' });
            const generationStream = await dependencies.startGenerationStream({
              taskInput,
              strategy,
              referenceMode: referenceSelection.reference_mode,
              referenceBlocks: referenceBlocks.map((block) => ({
                referenceType: block.reference_type,
                promptBlock: block.promptBlock,
              })),
            });

            let fullText = '';
            for await (const chunk of generationStream.textStream) {
              fullText += chunk;
              sendEvent('generation_delta', { text: chunk });
            }

            currentStep = 'persisting';
            const parsed = parseGenerationOutput(fullText);
            await dependencies.saveTaskOutputs(task.id, parsed);
            await dependencies.updateTask(task.id, {
              status: 'completed',
              referenceMode: referenceSelection.reference_mode,
            });
            sendEvent('generation_complete', parsed);
            sendEvent('done', { task_id: task.id });
          } catch (error) {
            await dependencies.updateTask(task.id, { status: 'failed' });
            sendEvent('error', {
              message: getErrorMessage(error),
              step: currentStep,
            });
          } finally {
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
