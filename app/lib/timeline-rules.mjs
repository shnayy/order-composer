const LAST_TWO_MINUTES = 2 * 60;

export const ORDER_TIMELINE_RULES = {
  "100": {
    nextOrderWaitSeconds: 5,
  },
  "200": {
    adjustEffectSeconds({ effectSeconds, remainingAtStart, waitSeconds }) {
      const secondsUntilLastTwoMinutes = remainingAtStart - waitSeconds - LAST_TWO_MINUTES;
      return Math.min(effectSeconds, Math.max(0, secondsUntilLastTwoMinutes));
    },
  },
};

function nonNegativeSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

export function calculateTimeline(items, totalSeconds = 15 * 60) {
  let elapsed = 0;
  let nextWaitSeconds = null;

  return items.map((item) => {
    const startsAt = totalSeconds - elapsed;
    const rule = ORDER_TIMELINE_RULES[item.order.orderId];
    const baseWaitSeconds = nonNegativeSeconds(item.order.waitSeconds);
    const baseEffectSeconds = nonNegativeSeconds(item.order.effectSeconds);
    const isWaitItem = item.order.categoryId === "wait";
    const waitSeconds = nonNegativeSeconds(isWaitItem ? baseWaitSeconds : (nextWaitSeconds ?? baseWaitSeconds));
    if (!isWaitItem) nextWaitSeconds = null;

    const adjustedEffectSeconds = rule?.adjustEffectSeconds?.({
      effectSeconds: baseEffectSeconds,
      remainingAtStart: startsAt,
      waitSeconds,
    });
    const effectSeconds = nonNegativeSeconds(adjustedEffectSeconds ?? baseEffectSeconds);

    elapsed += waitSeconds + effectSeconds;
    if (Number.isFinite(rule?.nextOrderWaitSeconds)) {
      nextWaitSeconds = nonNegativeSeconds(rule.nextOrderWaitSeconds);
    }

    return {
      ...item,
      startsAt,
      endsAt: elapsed,
      remaining: totalSeconds - elapsed,
      waitSeconds,
      effectSeconds,
    };
  });
}
