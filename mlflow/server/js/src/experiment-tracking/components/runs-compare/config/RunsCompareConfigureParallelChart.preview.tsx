import { RunsChartsRunData } from '../../runs-charts/components/RunsCharts.common';
import LazyParallelCoordinatesPlot, { processParallelCoordinateData } from '../charts/LazyParallelCoordinatesPlot';
import { useRunsChartsTooltip } from '../../runs-charts/hooks/useRunsChartsTooltip';
import { RunsCompareParallelCardConfig } from '../runs-compare.types';
import { shouldEnableDeepLearningUIPhase2 } from '../../../../common/utils/FeatureUtils';
import { useMemo } from 'react';
import { FormattedMessage } from 'react-intl';

export const RunsCompareConfigureParallelChartPreview = ({
  previewData,
  cardConfig,
  groupBy,
}: {
  previewData: RunsChartsRunData[];
  cardConfig: RunsCompareParallelCardConfig;
  groupBy: string;
}) => {
  const runGroupingEnabled = shouldEnableDeepLearningUIPhase2();

  const selectedParamsCount = cardConfig.selectedParams?.length || 0;
  const selectedMetricsCount = cardConfig.selectedMetrics?.length || 0;

  const isConfigured = selectedParamsCount + selectedMetricsCount >= 2;

  const { setTooltip, resetTooltip } = useRunsChartsTooltip(cardConfig);

  const containsStringValues = useMemo(
    () =>
      cardConfig.selectedParams?.some(
        (paramKey) => previewData.some((dataTrace) => isNaN(Number(dataTrace.params[paramKey]?.value))),
        [cardConfig.selectedParams, previewData],
      ),
    [cardConfig.selectedParams, previewData],
  );

  if (containsStringValues && groupBy && runGroupingEnabled) {
    return (
      <div css={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <FormattedMessage
          defaultMessage="Parallel coordinates chart does not support aggregated string values. Use other parameters or disable run grouping to continue."
          description="Experiment page > compare runs > parallel coordinates chart configuration modal > unsupported string values warning"
        />
      </div>
    );
  }

  const filteredData = isConfigured
    ? processParallelCoordinateData(previewData, cardConfig.selectedParams, cardConfig.selectedMetrics)
    : [];

  if (!isConfigured) {
    return (
      <div css={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        Select at least two metrics and params first
      </div>
    );
  }

  return filteredData.length ? (
    /* Avoid displaying empty set, otherwise parcoord-es crashes */
    <LazyParallelCoordinatesPlot
      selectedMetrics={cardConfig.selectedMetrics}
      selectedParams={cardConfig.selectedParams}
      data={filteredData}
      axesRotateThreshold={6}
      onHover={setTooltip}
      onUnhover={resetTooltip}
    />
  ) : null;
};
