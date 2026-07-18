export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60] as const;

export type ReviewProgress = {
  consecutiveCorrect: number;
  isWrong: boolean;
  masteredAt: Date | null;
  nextReviewAt: Date | null;
  reviewLevel: number;
};

export type ReviewDueStatus =
  | "scheduled"
  | "due_today"
  | "overdue"
  | "paused";

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localParts(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = new Map(
    parts.map((part) => [part.type, Number(part.value)]),
  );

  return {
    day: values.get("day") ?? 0,
    hour: values.get("hour") ?? 0,
    minute: values.get("minute") ?? 0,
    month: values.get("month") ?? 0,
    second: values.get("second") ?? 0,
    year: values.get("year") ?? 0,
  };
}

function localDateKey(date: Date, timeZone: string) {
  const parts = localParts(date, timeZone);
  return (
    parts.year * 10_000 +
    parts.month * 100 +
    parts.day
  );
}

function timeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const parts = localParts(date, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return localAsUtc - date.getTime();
}

function localMidnightUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
) {
  const localAsUtc = Date.UTC(year, month - 1, day);
  const firstGuess = new Date(localAsUtc);
  const firstOffset = timeZoneOffsetMilliseconds(
    firstGuess,
    timeZone,
  );
  const secondGuess = new Date(localAsUtc - firstOffset);
  const secondOffset = timeZoneOffsetMilliseconds(
    secondGuess,
    timeZone,
  );

  return new Date(localAsUtc - secondOffset);
}

export function nextReviewAtForLevel(
  attemptedAt: Date,
  reviewLevel: number,
  timeZone: string,
) {
  const interval =
    REVIEW_INTERVAL_DAYS[
      Math.min(
        Math.max(Math.trunc(reviewLevel), 0),
        REVIEW_INTERVAL_DAYS.length - 1,
      )
    ];
  const attemptedLocal = localParts(attemptedAt, timeZone);
  const targetCalendarDate = new Date(
    Date.UTC(
      attemptedLocal.year,
      attemptedLocal.month - 1,
      attemptedLocal.day + interval,
    ),
  );

  return localMidnightUtc(
    targetCalendarDate.getUTCFullYear(),
    targetCalendarDate.getUTCMonth() + 1,
    targetCalendarDate.getUTCDate(),
    timeZone,
  );
}

export function updateReviewProgress(
  previous: ReviewProgress | null,
  attempt: {
    isCorrect: boolean;
    confidence: "certain" | "uncertain";
    attemptedAt: Date;
  },
  timeZone: string,
): ReviewProgress | null {
  if (!attempt.isCorrect) {
    return {
      consecutiveCorrect: 0,
      isWrong: true,
      masteredAt: null,
      nextReviewAt: nextReviewAtForLevel(
        attempt.attemptedAt,
        0,
        timeZone,
      ),
      reviewLevel: 0,
    };
  }

  if (!previous?.nextReviewAt) {
    return previous;
  }

  const reviewLevel = Math.min(
    previous.reviewLevel +
      (attempt.confidence === "certain" ? 2 : 1),
    REVIEW_INTERVAL_DAYS.length - 1,
  );
  const consecutiveCorrect = previous.consecutiveCorrect + 1;
  const isTemporarilyMastered = consecutiveCorrect >= 2;

  return {
    consecutiveCorrect,
    isWrong: !isTemporarilyMastered,
    masteredAt: isTemporarilyMastered
      ? previous.masteredAt ?? attempt.attemptedAt
      : null,
    nextReviewAt: nextReviewAtForLevel(
      attempt.attemptedAt,
      reviewLevel,
      timeZone,
    ),
    reviewLevel,
  };
}

export function getReviewDueStatus(
  nextReviewAt: Date | null,
  now: Date,
  timeZone: string,
): ReviewDueStatus {
  if (!nextReviewAt) {
    return "paused";
  }

  const dueDate = localDateKey(nextReviewAt, timeZone);
  const today = localDateKey(now, timeZone);
  if (dueDate < today) {
    return "overdue";
  }
  if (dueDate === today) {
    return "due_today";
  }
  return "scheduled";
}
