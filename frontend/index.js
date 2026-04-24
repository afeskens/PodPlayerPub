// Custom entry point that loads expo-router AND registers the
// react-native-track-player playback service so that remote events
// (Bluetooth / lock-screen / notification) reach our service handler.
import 'expo-router/entry';
import TrackPlayer from 'react-native-track-player';
import PlaybackService from './service';

TrackPlayer.registerPlaybackService(() => PlaybackService);
