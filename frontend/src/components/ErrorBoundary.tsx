import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "../theme";

type Props = {
  children: React.ReactNode;
  onReset?: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Notify listener so the player context can stop audio etc.
    this.props.onReset?.();
    // eslint-disable-next-line no-console
    console.warn("ErrorBoundary caught:", error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <View style={styles.card}>
            <Ionicons name="warning" size={28} color={colors.accent} />
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.sub} numberOfLines={4}>
              {this.state.error?.message || "Unknown error"}
            </Text>
            <TouchableOpacity style={styles.btn} onPress={this.reset} testID="error-retry">
              <Ionicons name="refresh" size={16} color={colors.background} />
              <Text style={styles.btnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 10,
  },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  sub: { color: colors.textSecondary, fontSize: 13, textAlign: "center", lineHeight: 19 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  btnText: { color: colors.background, fontWeight: "700", fontSize: 13 },
});
