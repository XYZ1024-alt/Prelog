type ModerationInput = {
  readonly body: string;
  readonly email: string;
  readonly website?: string;
};

const SPAM_WORDS = ["http://", "https://", "[url", "casino", "loan", "viagra"];
const URL_PATTERN = /https?:\/\//gi;
const MAX_LINKS = 2;
const LONG_REPEATED_CHAR_PATTERN = /(.)\1{12,}/;
const APPROVE_THRESHOLD = 3;

export function moderateComment(input: ModerationInput) {
  const spamScore = getSpamScore(input);

  return {
    moderationNote: getModerationNote(spamScore),
    spamScore,
    status: spamScore >= APPROVE_THRESHOLD ? "SPAM" as const : "PENDING" as const,
  };
}

function getSpamScore(input: ModerationInput) {
  const text = `${input.body} ${input.email}`.toLowerCase();
  const linkCount = input.body.match(URL_PATTERN)?.length ?? 0;
  let score = 0;

  if (input.website) {
    score += 4;
  }

  if (linkCount > MAX_LINKS) {
    score += 2;
  }

  if (LONG_REPEATED_CHAR_PATTERN.test(input.body)) {
    score += 1;
  }

  score += SPAM_WORDS.filter((word) => text.includes(word)).length;
  return score;
}

function getModerationNote(score: number) {
  if (score >= APPROVE_THRESHOLD) {
    return `自动标记为垃圾评论，垃圾分 ${score}`;
  }

  return `待人工审核，垃圾分 ${score}`;
}
