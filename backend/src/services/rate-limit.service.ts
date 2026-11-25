
import redis from "../config/redis";

const ONE_HOUR_MS = 60 * 60 * 1000;

const RATE_LIMIT_SCRIPT = `
  local key = KEYS[1]

  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local minDelay = tonumber(ARGV[4])
  local member = ARGV[5]

  -- Remove reservations older than one hour
  redis.call("ZREMRANGEBYSCORE", key, "-inf", now - window)

  -- Avoid counting the same email twice
  local existing = redis.call("ZSCORE", key, member)

  if existing then
    return {1, now}
  end

  local count = redis.call("ZCARD", key)

  -- Find the most recent reservation
  local latest = redis.call("ZREVRANGE", key, 0, 0, "WITHSCORES")

  local spacingAt = now

  if #latest > 0 then
    spacingAt = tonumber(latest[2]) + minDelay
  end

  -- Find when the hourly limit allows another email
  local hourlyAt = now

  if count >= limit then
    local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
    hourlyAt = tonumber(oldest[2]) + window
  end

  local retryAt = math.max(spacingAt, hourlyAt)

  if retryAt > now then
    return {0, retryAt}
  end

  -- Reserve this email's sending slot
  redis.call("ZADD", key, now, member)
  redis.call("PEXPIRE", key, window * 2)

  return {1, now}
`;

interface RateLimitInput {
  senderId: string;
  emailId: string;
  hourlyLimit: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAt: Date | null;
}

export async function checkRateLimit(
  input: RateLimitInput
): Promise<RateLimitResult> {
  const now = Date.now();

  const minDelaySeconds =
    Number(process.env.MIN_DELAY_SECONDS) || 2;

  const result = (await redis.eval(
    RATE_LIMIT_SCRIPT,
    1,
    `email-rate-limit:${input.senderId}`,
    now,
    ONE_HOUR_MS,
    input.hourlyLimit,
    minDelaySeconds * 1000,
    input.emailId
  )) as [number, number];

  const [allowed, retryAt] = result;

  return {
    allowed: Number(allowed) === 1,
    retryAt: Number(allowed) === 1 ? null : new Date(Number(retryAt)),
  };
}
