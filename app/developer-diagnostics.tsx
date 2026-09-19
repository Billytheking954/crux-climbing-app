import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Clipboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/core/AppButton';
import { CruxTheme, DefaultCruxScheme, Layout, Radius, Spacing, Stroke, Typography } from '@/constants/theme';
import {
  formatAiDiagnosticsReport,
  runFullLifecycleTest,
  type LifecycleStepResult,
  type LifecycleTestResult,
} from '@/data/diagnostics/storage-lifecycle-test';

const scheme = DefaultCruxScheme;
const theme = CruxTheme[scheme];
const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

function statusLabel(status: LifecycleStepResult['status']): string {
  if (status === 'passed') return 'PASS';
  if (status === 'failed') return 'FAIL';
  if (status === 'running') return 'RUNNING';
  if (status === 'skipped') return 'SKIPPED';
  return 'WAITING';
}

export default function DeveloperDiagnosticsScreen() {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<LifecycleStepResult[]>([]);
  const [result, setResult] = useState<LifecycleTestResult | null>(null);
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => result && !result.passed ? formatAiDiagnosticsReport(result) : null, [result]);

  const runTest = useCallback(async () => {
    if (running) return;
    setRunning(true); setResult(null); setSteps([]); setCopied(false);
    try {
      const next = await runFullLifecycleTest(setSteps);
      setSteps(next.steps); setResult(next);
    } finally {
      setRunning(false);
    }
  }, [running]);

  const copyReport = useCallback(() => {
    if (!report) return;
    Clipboard.setString(report);
    setCopied(true);
  }, [report]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>DEVELOPER TOOLS</Text>
          <Text style={styles.title}>Storage diagnostics</Text>
          <Text style={styles.subtitle}>Runs a real create, read, edit and delete cycle through CRUX storage. Test data is isolated and removed afterwards.</Text>
        </View>

        <AppButton label={running ? 'Running lifecycle test' : 'Run Full Lifecycle Test'} loading={running} disabled={running} scheme={scheme} onPress={() => { void runTest(); }} />

        {steps.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Test sequence</Text>
            {steps.map((step) => (
              <View key={step.step} style={styles.stepRow}>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepTitle}>{`Step ${step.step}: ${step.label}`}</Text>
                  {step.detail ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
                </View>
                {step.status === 'running' ? <ActivityIndicator size="small" /> : <Text style={[styles.status, step.status === 'passed' && styles.pass, step.status === 'failed' && styles.fail]}>{statusLabel(step.status)}</Text>}
              </View>
            ))}
          </View>
        ) : null}

        {result ? (
          <View style={[styles.result, result.passed ? styles.resultPass : styles.resultFail]}>
            <Text style={styles.resultTitle}>{result.passed ? 'Lifecycle test passed' : 'Lifecycle test failed'}</Text>
            <Text style={styles.resultBody}>{result.passed ? `All six storage checks passed in ${result.durationMs} ms and the temporary test session was removed.` : `${result.failure?.stepLabel ?? 'Diagnostic runner'} failed. The AI Diagnostics Report below contains the failure evidence.`}</Text>
          </View>
        ) : null}

        {report ? (
          <View style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={styles.reportHeading}>
                <Text style={styles.reportEyebrow}>FAILURE OUTPUT</Text>
                <Text style={styles.reportTitle}>AI Diagnostics Report</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={copyReport} style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.65 }]}>
                <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy to Clipboard'}</Text>
              </Pressable>
            </View>
            <View style={styles.reportBody}><Text selectable style={styles.reportText}>{report}</Text></View>
          </View>
        ) : null}

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Safety rule</Text>
          <Text style={styles.noteText}>Diagnostics will not run while a real climbing session is active. Finish the session first so the test cannot reuse or alter genuine climbing data.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  content: { paddingHorizontal: Layout.horizontalPadding, paddingTop: Spacing.md, paddingBottom: Spacing.xxxl, width: '100%', maxWidth: Layout.maxContentWidth, alignSelf: 'center', gap: Spacing.lg },
  backButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingRight: Spacing.md },
  backText: { color: theme.textPrimary, ...Typography.bodyStrong },
  header: { gap: Spacing.xxs },
  eyebrow: { color: theme.textMuted, fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.1 },
  title: { color: theme.textPrimary, ...Typography.screenTitle },
  subtitle: { color: theme.textMuted, ...Typography.body, maxWidth: 620 },
  card: { borderWidth: Stroke.default, borderColor: theme.border, borderRadius: Radius.lg, backgroundColor: theme.surface, paddingHorizontal: Spacing.md },
  cardTitle: { color: theme.textPrimary, ...Typography.bodyStrong, paddingVertical: Spacing.md },
  stepRow: { minHeight: 64, borderTopWidth: Stroke.default, borderTopColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepCopy: { flex: 1, paddingVertical: Spacing.sm },
  stepTitle: { color: theme.textPrimary, ...Typography.bodyStrong },
  stepDetail: { color: theme.textMuted, ...Typography.caption, marginTop: 2 },
  status: { color: theme.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.8 },
  pass: { color: theme.success },
  fail: { color: '#9A3430' },
  result: { borderWidth: Stroke.default, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.xxs },
  resultPass: { borderColor: '#B9D2BF', backgroundColor: '#F1F6F2' },
  resultFail: { borderColor: '#DFC0BD', backgroundColor: '#FBF1F0' },
  resultTitle: { color: theme.textPrimary, ...Typography.bodyStrong },
  resultBody: { color: theme.textMuted, ...Typography.body },
  reportCard: { borderWidth: Stroke.default, borderColor: theme.borderStrong, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: theme.surface },
  reportHeader: { padding: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, borderBottomWidth: Stroke.default, borderBottomColor: theme.border },
  reportHeading: { flex: 1 },
  reportEyebrow: { color: '#9A3430', fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  reportTitle: { color: theme.textPrimary, ...Typography.bodyStrong, marginTop: 2 },
  copyButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.md, borderWidth: Stroke.default, borderColor: theme.borderStrong, borderRadius: Radius.md, backgroundColor: theme.background },
  copyText: { color: theme.textPrimary, ...Typography.caption, fontWeight: '700' },
  reportBody: { padding: Spacing.md, backgroundColor: '#1C1C19' },
  reportText: { fontFamily: mono, fontSize: 11, lineHeight: 17, color: '#F0EEE8' },
  note: { padding: Spacing.md, borderRadius: Radius.md, backgroundColor: theme.surfaceRaised },
  noteTitle: { color: theme.textPrimary, ...Typography.bodyStrong },
  noteText: { color: theme.textMuted, ...Typography.caption, marginTop: Spacing.xxs },
});
