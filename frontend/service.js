// react-native-track-player playback service.
// Handles remote control events from lock screen / notification / BT headphones.
// Runs in its own JS context when the app is backgrounded, so it can't share
// React state directly — reads persisted settings from AsyncStorage.
const TrackPlayer = require("react-native-track-player").default;
const { Event } = require("react-native-track-player");
const AsyncStorage = require("@react-native-async-storage/async-storage").default;

const SETTINGS_KEY = "@pp:settings";

async function getSkip(direction) {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return direction === "forward" ? 30 : 10;
    const parsed = JSON.parse(raw);
    if (direction === "forward") return parsed.skipForward || 30;
    return parsed.skipBackward || 10;
  } catch {
    return direction === "forward" ? 30 : 10;
  }
}

module.exports = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    try { TrackPlayer.reset(); } catch {}
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    TrackPlayer.seekTo(position);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async () => {
    const n = await getSkip("forward");
    const pos = await TrackPlayer.getPosition();
    TrackPlayer.seekTo(pos + n);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async () => {
    const n = await getSkip("backward");
    const pos = await TrackPlayer.getPosition();
    TrackPlayer.seekTo(Math.max(0, pos - n));
  });
  // Remote next/previous: broadcast a flag AsyncStorage can pick up in the
  // React layer via polling if needed. For now, treat next as jump-forward 30s
  // so users don't accidentally skip the whole show from lock screen.
  TrackPlayer.addEventListener(Event.RemoteDuck, async ({ paused }) => {
    if (paused) {
      try { TrackPlayer.pause(); } catch {}
    }
  });
};
