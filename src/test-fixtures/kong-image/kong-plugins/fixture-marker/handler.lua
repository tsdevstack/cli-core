-- Test fixture: answers every request on its route with a marker header,
-- so a test can prove the plugin was copied into the image and enabled.
local FixtureMarker = {
  PRIORITY = 5,
  VERSION = "0.0.1",
}

function FixtureMarker:access(conf)
  return kong.response.exit(200, { plugin = "fixture-marker" }, {
    ["X-Fixture-Marker"] = conf.message,
  })
end

return FixtureMarker
