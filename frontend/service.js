// react-native-track-player playback service
// Handles lock-screen / Bluetooth / notification remote events
import TrackPlayer, { Event } from 'react-native-track-player';

module.exports = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    TrackPlayer.skipToNext().catch(() => {});
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    TrackPlayer.skipToPrevious().catch(() => {});
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    TrackPlayer.seekTo(position);
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async ({ interval }) => {
    try {
      const { position } = await TrackPlayer.getProgress();
      await TrackPlayer.seekTo(position + (interval || 30));
    } catch {}
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async ({ interval }) => {
    try {
      const { position } = await TrackPlayer.getProgress();
      await TrackPlayer.seekTo(Math.max(0, position - (interval || 15)));
    } catch {}
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.reset().catch(() => {});
  });

  TrackPlayer.addEventListener(Event.RemoteDuck, async ({ paused, permanent }) => {
    if (permanent) {
      TrackPlayer.pause();
    } else if (paused) {
      TrackPlayer.pause();
    } else {
      TrackPlayer.play();
    }
  });
};
