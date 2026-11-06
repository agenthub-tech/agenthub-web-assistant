import { beforeEach, describe, expect, it } from 'vitest';
import { StepTracker } from './step-tracker';

describe('StepTracker internal plan calls', () => {
  let container: HTMLElement;
  let tracker: StepTracker;

  beforeEach(() => {
    container = document.createElement('div');
    tracker = new StepTracker(container);
  });

  it.each([undefined, { step_description: '更新计划' }])(
    'hides live and restored plan steps even with a description: %j',
    (params) => {
      tracker.addStep('plan', 'update_plan', params);
      tracker.completeStep('plan');

      expect(container.children).toHaveLength(0);
      expect(tracker.getLastRunningStep()).toBeNull();
    },
  );

  it('preserves knowledge steps and their completion around hidden plan calls', () => {
    tracker.addStep('lookup', 'knowledge_skill', { step_description: '查找考勤制度' });
    tracker.addStep('plan', 'update_plan');
    tracker.completeStep('plan');

    expect(tracker.getLastRunningStep()).toBe('lookup');
    expect(container.children).toHaveLength(1);
    expect(container.textContent?.trim()).toBe('查找考勤制度');

    tracker.completeStep('lookup');
    expect(tracker.getLastRunningStep()).toBeNull();
    expect(container.textContent).toMatch(/查找考勤制度\d+ms/);
  });
});
