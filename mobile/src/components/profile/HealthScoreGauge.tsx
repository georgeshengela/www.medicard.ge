import React from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';
import {
  FIGMA_GAUGE_ARC_LAYERS,
  FIGMA_RESULT,
  GAUGE_ACTIVE_COLOR,
  GAUGE_STROKE_WIDTH,
  GAUGE_TRACK_COLOR,
  gaugeProgressClipD,
  layerFrameTransform,
  scoreKnobBox,
} from '@/constants/assessmentResultAssets';
import {
  FIGMA_ASSESSMENT_RESULT,
  FIGMA_ASSESSMENT_RESULT_SHADOW,
  useFigmaAssessmentResult,
} from '@/constants/figmaAssessmentResultLayout';
import { ka } from '@/i18n/ka';

const SCREEN_W = Dimensions.get('window').width;
const SCALE = SCREEN_W / FIGMA_RESULT.frameWidth;
const GAUGE_W = SCREEN_W;
const GAUGE_H = FIGMA_RESULT.frameHeight * SCALE;

type GaugeProps = {
  score: number;
  labelKa: string;
  onInfoPress?: () => void;
};

/** Figma 8845:313440 — gauge frame 8910:69693. */
export function HealthScoreGauge({ score, labelKa, onInfoPress }: GaugeProps) {
  const FIGMA_ASSESSMENT_RESULT = useFigmaAssessmentResult();
  const knob = scoreKnobBox(score);
  const { scoreBlockLeft, scoreBlockTop, scoreBlockWidth, scoreGap } = FIGMA_RESULT;
  const clipD = gaugeProgressClipD(score);

  return (
    <View style={{ width: GAUGE_W, height: GAUGE_H, alignSelf: 'center' }}>
      <Svg
        width={GAUGE_W}
        height={GAUGE_H}
        viewBox={`0 0 ${FIGMA_RESULT.frameWidth} ${FIGMA_RESULT.frameHeight}`}
      >
        <Defs>
          <ClipPath id="gaugeProgressClip">
            <Path d={clipD} />
          </ClipPath>
        </Defs>

        {/* Figma 8845:313535 — full gray track (exact 4 arc layers) */}
        {FIGMA_GAUGE_ARC_LAYERS.map((layer) => {
          const { x, y } = layerFrameTransform(layer);
          return (
            <G key={`track-${layer.id}`} transform={`translate(${x}, ${y})`}>
              <Path
                d={layer.d}
                stroke={GAUGE_TRACK_COLOR}
                strokeWidth={GAUGE_STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </G>
          );
        })}

        {/* Dynamic orange — same Figma arc layers, clipped to score */}
        <G clipPath="url(#gaugeProgressClip)">
          {FIGMA_GAUGE_ARC_LAYERS.map((layer) => {
            const { x, y } = layerFrameTransform(layer);
            return (
              <G key={`active-${layer.id}`} transform={`translate(${x}, ${y})`}>
                <Path
                  d={layer.d}
                  stroke={GAUGE_ACTIVE_COLOR}
                  strokeWidth={GAUGE_STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </G>
            );
          })}
        </G>

        {/* Knob — Figma 8910:69696 shadow inset −50% −150% −250% −150% on 20×20 */}
        <G transform={`translate(${knob.left - 30}, ${knob.top - 10})`}>
          <Circle cx={40} cy={20} r={10} fill="#FFFFFF" />
          <Circle cx={40} cy={20} r={11} stroke="#F59E0B" strokeWidth={2} fill="none" />
        </G>
      </Svg>

      {/* Score block sits above arc SVG */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: GAUGE_W,
          height: GAUGE_H,
        }}
      >

      <Text
        style={{
          position: 'absolute',
          left: (FIGMA_RESULT.scaleZeroX - 8) * SCALE,
          top: FIGMA_RESULT.scaleY * SCALE,
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 12,
          lineHeight: 16,
          color: FIGMA_ASSESSMENT_RESULT.labelColor,
          width: 16,
          textAlign: 'center',
        }}
      >
        0
      </Text>
      <Text
        style={{
          position: 'absolute',
          left: (FIGMA_RESULT.scaleHundredX - 14) * SCALE,
          top: FIGMA_RESULT.scaleY * SCALE,
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 12,
          lineHeight: 16,
          color: FIGMA_ASSESSMENT_RESULT.labelColor,
          width: 28,
          textAlign: 'center',
        }}
      >
        100
      </Text>

      <View
        style={{
          position: 'absolute',
          left: scoreBlockLeft * SCALE,
          top: scoreBlockTop * SCALE,
          width: scoreBlockWidth * SCALE,
          alignItems: 'center',
          gap: scoreGap * SCALE,
        }}
      >
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: FIGMA_ASSESSMENT_RESULT.scoreSize * SCALE,
            lineHeight: FIGMA_ASSESSMENT_RESULT.scoreLineHeight * SCALE,
            color: FIGMA_ASSESSMENT_RESULT.titleColor,
            letterSpacing: -0.75,
            textAlign: 'center',
          }}
        >
          {score.toFixed(1)}
        </Text>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_500Medium',
            fontSize: FIGMA_ASSESSMENT_RESULT.labelSize * SCALE,
            lineHeight: FIGMA_ASSESSMENT_RESULT.labelLineHeight * SCALE,
            color: FIGMA_ASSESSMENT_RESULT.labelColor,
            letterSpacing: -0.25,
            textAlign: 'center',
          }}
        >
          {labelKa}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onInfoPress}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: FIGMA_ASSESSMENT_RESULT.hintSize,
              lineHeight: 16,
              color: FIGMA_ASSESSMENT_RESULT.labelColor,
            }}
          >
            {ka.profileSetup.whatDoesThisMean}
          </Text>
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Path
              d="M8 7.5C8.27614 7.5 8.5 7.72386 8.5 8V11.3333C8.5 11.6095 8.27614 11.8333 8 11.8333C7.72386 11.8333 7.5 11.6095 7.5 11.3333V8C7.5 7.72386 7.72386 7.5 8 7.5Z"
              fill="#9CA3AF"
            />
            <Path
              d="M8 4.66667C8.46024 4.66667 8.83333 5.03976 8.83333 5.5C8.83333 5.96024 8.46024 6.33333 8 6.33333C7.53976 6.33333 7.16667 5.96024 7.16667 5.5C7.16667 5.03976 7.53976 4.66667 8 4.66667Z"
              fill="#9CA3AF"
            />
            <Path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M8 1.5C11.5899 1.5 14.5 4.41015 14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5ZM8 2.5C4.96243 2.5 2.5 4.96243 2.5 8C2.5 11.0376 4.96243 13.5 8 13.5C11.0376 13.5 13.5 11.0376 13.5 8C13.5 4.96243 11.0376 2.5 8 2.5Z"
              fill="#9CA3AF"
            />
          </Svg>
        </Pressable>
      </View>
      </View>
    </View>
  );
}

/** Figma 8845:313571 */
export function HealthScoreConfidenceBadge({ confidence }: { confidence: number }) {
  const FIGMA_ASSESSMENT_RESULT = useFigmaAssessmentResult();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: FIGMA_ASSESSMENT_RESULT.confidenceBadgeBorder,
        backgroundColor: FIGMA_ASSESSMENT_RESULT.confidenceBadgeBg,
        ...FIGMA_ASSESSMENT_RESULT_SHADOW,
      }}
    >
      <Svg width={20} height={20} viewBox="0 0 20 20">
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.5 6.875C12.8452 6.875 13.125 7.15482 13.125 7.5V12.5C13.125 12.8452 12.8452 13.125 12.5 13.125H7.5C7.15482 13.125 6.875 12.8452 6.875 12.5V7.5C6.875 7.15482 7.15482 6.875 7.5 6.875H12.5ZM8.125 11.875H11.875V8.125H8.125V11.875Z"
          fill="#4B5563"
        />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.5 1.04167C12.8452 1.04167 13.125 1.32149 13.125 1.66667V3.54167H14.1667C15.4323 3.54167 16.4583 4.56768 16.4583 5.83333V6.875H18.3333C18.6785 6.875 18.9583 7.15482 18.9583 7.5C18.9583 7.84518 18.6785 8.125 18.3333 8.125H16.4583V11.875H18.3333C18.6785 11.875 18.9583 12.1548 18.9583 12.5C18.9583 12.8452 18.6785 13.125 18.3333 13.125H16.4583V14.1667C16.4583 15.4323 15.4323 16.4583 14.1667 16.4583H13.125V18.3333C13.125 18.6785 12.8452 18.9583 12.5 18.9583C12.1548 18.9583 11.875 18.6785 11.875 18.3333V16.4583H8.125V18.3333C8.125 18.6785 7.84518 18.9583 7.5 18.9583C7.15482 18.9583 6.875 18.6785 6.875 18.3333V16.4583H5.83333C4.56768 16.4583 3.54167 15.4323 3.54167 14.1667V13.125H1.66667C1.32149 13.125 1.04167 12.8452 1.04167 12.5C1.04167 12.1548 1.32149 11.875 1.66667 11.875H3.54167V8.125H1.66667C1.32149 8.125 1.04167 7.84518 1.04167 7.5C1.04167 7.15482 1.32149 6.875 1.66667 6.875H3.54167V5.83333C3.54167 4.56768 4.56768 3.54167 5.83333 3.54167H6.875V1.66667C6.875 1.32149 7.15482 1.04167 7.5 1.04167C7.84518 1.04167 8.125 1.32149 8.125 1.66667V3.54167H11.875V1.66667C11.875 1.32149 12.1548 1.04167 12.5 1.04167ZM5.83333 4.79167C5.25804 4.79167 4.79167 5.25804 4.79167 5.83333V14.1667C4.79167 14.742 5.25804 15.2083 5.83333 15.2083H14.1667C14.742 15.2083 15.2083 14.742 15.2083 14.1667V5.83333C15.2083 5.25804 14.742 4.79167 14.1667 4.79167H5.83333Z"
          fill="#4B5563"
        />
      </Svg>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_500Medium',
          fontSize: 14,
          lineHeight: 20,
          color: FIGMA_ASSESSMENT_RESULT.titleColor,
        }}
      >
        {ka.profileSetup.confidenceLabel(confidence)}
      </Text>
    </View>
  );
}

export function AssessmentResultChevronDown({ rotated }: { rotated?: boolean }) {
  return (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      style={rotated ? { transform: [{ rotate: '180deg' }] } : undefined}
    >
      <Path
        d="M19.4697 8.46979C19.7626 8.1769 20.2373 8.1769 20.5302 8.46979C20.8231 8.76269 20.8231 9.23746 20.5302 9.53034L12.5302 17.5303C12.3896 17.671 12.1988 17.75 11.9999 17.7501C11.8011 17.7501 11.6103 17.671 11.4697 17.5303L3.46967 9.53034C3.17678 9.23745 3.17678 8.76269 3.46967 8.46979C3.76256 8.1769 4.23732 8.1769 4.53022 8.46979L11.9999 15.9395L19.4697 8.46979Z"
        fill="#9CA3AF"
      />
    </Svg>
  );
}

export function AssessmentResultCheckCircle() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 1.875C14.4873 1.875 18.125 5.51269 18.125 10C18.125 14.4873 14.4873 18.125 10 18.125C5.51269 18.125 1.875 14.4873 1.875 10C1.875 5.51269 5.51269 1.875 10 1.875ZM14.1919 7.47477C13.9478 7.23069 13.5522 7.23069 13.3081 7.47477L8.75 12.0329L6.69189 9.97477C6.44782 9.73069 6.05218 9.73069 5.80811 9.97477C5.56403 10.2188 5.56403 10.6145 5.80811 10.8586L8.30811 13.3586C8.55218 13.6026 8.94782 13.6026 9.19189 13.3586L14.1919 8.35856C14.436 8.11448 14.436 7.71885 14.1919 7.47477Z"
        fill="#22C55E"
      />
    </Svg>
  );
}

export function AssessmentResultShare() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17 2.25C19.0711 2.25 20.75 3.92893 20.75 6C20.75 8.07107 19.0711 9.75 17 9.75C15.8501 9.75 14.8217 9.2319 14.1338 8.41699L9.58496 10.8984C9.69188 11.2468 9.75 11.6166 9.75 12C9.75 12.3835 9.69095 12.7531 9.58398 13.1016L14.1328 15.582C14.8207 14.7672 15.8501 14.25 17 14.25C19.0711 14.25 20.75 15.9289 20.75 18C20.75 20.0711 19.0711 21.75 17 21.75C14.9289 21.75 13.25 20.0711 13.25 18C13.25 17.6167 13.3072 17.2467 13.4141 16.8984L8.86523 14.417C8.17735 15.2316 7.14969 15.75 6 15.75C3.92893 15.75 2.25 14.0711 2.25 12C2.25 9.92893 3.92893 8.25 6 8.25C7.14965 8.25 8.17833 8.76746 8.86621 9.58203L13.415 7.10156C13.3081 6.7532 13.25 6.38341 13.25 6C13.25 3.92893 14.9289 2.25 17 2.25ZM17 15.75C15.7574 15.75 14.75 16.7574 14.75 18C14.75 19.2426 15.7574 20.25 17 20.25C18.2426 20.25 19.25 19.2426 19.25 18C19.25 16.7574 18.2426 15.75 17 15.75ZM6 9.75C4.75736 9.75 3.75 10.7574 3.75 12C3.75 13.2426 4.75736 14.25 6 14.25C7.24264 14.25 8.25 13.2426 8.25 12C8.25 10.7574 7.24264 9.75 6 9.75ZM17 3.75C15.7574 3.75 14.75 4.75736 14.75 6C14.75 7.24264 15.7574 8.25 17 8.25C18.2426 8.25 19.25 7.24264 19.25 6C19.25 4.75736 18.2426 3.75 17 3.75Z"
        fill="#9CA3AF"
      />
    </Svg>
  );
}
