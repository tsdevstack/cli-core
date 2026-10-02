-- tsdevstack-api-key: limit windows (UTC), computed exactly like the
-- TypeScript contract in @tsdevstack/nest-common (getApiKeyWindowStart,
-- getApiKeyWindowEnd, getApiKeyWindowId, getApiKeyCounterExpireAt).
--
-- - minute, hour, day: start = now - now % unit; id = start
-- - week: Monday 00:00 UTC (ISO week); d = floor(now / 86400),
--   start = (d - (d + 3) % 7) * 86400 (day 0, 1970-01-01, was a Thursday)
-- - month: the 1st 00:00 UTC; id = YYYY-MM
-- - counters expire at the window end; week and month counters one day
--   later (QUOTA_COUNTER_RETENTION), so the usage sync can still copy the
--   final total of a finished period.

local floor = math.floor
local os_date = os.date
local string_format = string.format

local MINUTE = 60
local HOUR = 3600
local DAY = 86400
local WEEK = 7 * DAY
local QUOTA_COUNTER_RETENTION = DAY

local _M = {}

-- Window order used everywhere in the plugin and the script
_M.NAMES = { "minute", "hour", "day", "week", "month" }

-- Counter key segment of each window (apikey:{<h>}:<segment>:<id>)
_M.SEGMENTS = { "min", "hour", "day", "week", "month" }

-- Days since 1970-01-01 of a proleptic Gregorian date (H. Hinnant's
-- days_from_civil), independent of the process time zone.
local function days_from_civil(year, month, day)
  if month <= 2 then
    year = year - 1
  end
  local era = floor(year / 400)
  local yoe = year - era * 400
  local mp = month > 2 and month - 3 or month + 9
  local doy = floor((153 * mp + 2) / 5) + day - 1
  local doe = yoe * 365 + floor(yoe / 4) - floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
end

_M.days_from_civil = days_from_civil

-- Returns one entry per window, in _M.NAMES order:
-- { name, segment, id (string), start, ends (exclusive), expire_at }
function _M.compute(now)
  now = floor(now)
  local result = {}

  local function add(index, start, ends, id)
    local name = _M.NAMES[index]
    result[index] = {
      name = name,
      segment = _M.SEGMENTS[index],
      id = id or string_format("%d", start),
      start = start,
      ends = ends,
      expire_at = (name == "week" or name == "month")
        and ends + QUOTA_COUNTER_RETENTION or ends,
    }
  end

  local minute = now - now % MINUTE
  add(1, minute, minute + MINUTE)

  local hour = now - now % HOUR
  add(2, hour, hour + HOUR)

  local day = now - now % DAY
  add(3, day, day + DAY)

  local days = floor(now / DAY)
  local week = (days - (days + 3) % 7) * DAY
  add(4, week, week + WEEK)

  local date = os_date("!*t", now)
  local next_year, next_month = date.year, date.month + 1
  if next_month == 13 then
    next_year, next_month = next_year + 1, 1
  end
  add(5,
    days_from_civil(date.year, date.month, 1) * DAY,
    days_from_civil(next_year, next_month, 1) * DAY,
    string_format("%04d-%02d", date.year, date.month))

  return result
end

return _M
