import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, LayoutChangeEvent } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

interface ExerciseVideoPlayerProps {
  videoSource?: string | null;
  height?: number;
  onReady?: () => void;
}

/**
 * Extracts an 11-character YouTube video ID from various formats:
 * - Direct ID: "Ksbk8gFS9CA"
 * - Short URL: "https://youtu.be/Ksbk8gFS9CA?si=..."
 * - Watch URL: "https://www.youtube.com/watch?v=Ksbk8gFS9CA"
 * - Embed URL: "https://www.youtube.com/embed/Ksbk8gFS9CA"
 * - Iframe embed snippet: <iframe src="https://www.youtube.com/embed/Ksbk8gFS9CA..." ...></iframe>
 */
export function extractYouTubeVideoId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Match iframes: src="https://www.youtube.com/embed/VIDEO_ID..."
  const iframeMatch = trimmed.match(/src=["'](?:https?:)?\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (iframeMatch) return iframeMatch[1];

  // Match /embed/VIDEO_ID
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (embedMatch) return embedMatch[1];

  // Match youtu.be/VIDEO_ID
  const youtuBeMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (youtuBeMatch) return youtuBeMatch[1];

  // Match watch?v=VIDEO_ID
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (watchMatch) return watchMatch[1];

  // Direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export default function ExerciseVideoPlayer({ videoSource, height: customHeight, onReady }: ExerciseVideoPlayerProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [loading, setLoading] = useState(true);

  const videoId = extractYouTubeVideoId(videoSource);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
    }
  }, [containerWidth]);

  // Compute 16:9 aspect ratio height based on layout width or fallback to 215
  const computedHeight = customHeight ?? (containerWidth > 0 ? Math.round((containerWidth * 9) / 16) : 215);

  const handlePlayerReady = useCallback(() => {
    setLoading(false);
    onReady?.();
  }, [onReady]);

  if (!videoId) {
    return null;
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height: computedHeight }]} onLayout={onLayout}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 12,
            border: 'none',
            backgroundColor: '#000',
          } as any}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height: computedHeight }]} onLayout={onLayout}>
      {loading && (
        <View style={[styles.loadingOverlay, { height: computedHeight }]}>
          <ActivityIndicator size="small" color="#A3E635" />
        </View>
      )}
      <YoutubePlayer
        height={computedHeight}
        width={containerWidth || undefined}
        play={false}
        videoId={videoId}
        onReady={handlePlayerReady}
        webViewProps={{
          androidLayerType: 'hardware',
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#18181B',
    zIndex: 1,
  },
});
