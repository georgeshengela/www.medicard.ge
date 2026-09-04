import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Figma 8852:143210 chevron-right — outer 24, leaf 24. */
export function LabChevronRight({ color = '#9CA3AF' }: { color?: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.46967 3.46979C8.76256 3.1769 9.23732 3.1769 9.53022 3.46979L17.5302 11.4698C17.6708 11.6104 17.7499 11.8012 17.7499 12.0001C17.7499 12.199 17.6709 12.3897 17.5302 12.5303L9.53022 20.5303C9.23734 20.8232 8.76257 20.8232 8.46967 20.5303C8.17678 20.2374 8.17678 19.7627 8.46967 19.4698L15.9394 12.0001L8.46967 4.53034C8.17678 4.23745 8.17678 3.76268 8.46967 3.46979Z"
        fill={color}
      />
    </Svg>
  );
}

/** Figma 8852:143210 back chevron — outer 24, leaf 24. */
export function LabBackChevron({ color = '#4B5563' }: { color?: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.4697 3.46979C14.7626 3.1769 15.2374 3.1769 15.5303 3.46979C15.8231 3.76269 15.8232 4.23745 15.5303 4.53034L8.06055 12.0001L15.5303 19.4698C15.8231 19.7627 15.8232 20.2375 15.5303 20.5303C15.2374 20.8232 14.7626 20.8232 14.4697 20.5303L6.46973 12.5303C6.32909 12.3897 6.25002 12.199 6.25 12.0001C6.25 11.8012 6.32909 11.6104 6.46973 11.4698L14.4697 3.46979Z"
        fill={color}
      />
    </Svg>
  );
}

/** Figma 8852:143210 sort chevron — outer 20. */
export function LabChevronDown({ color = '#14B8A6' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M4.558 6.225a.75.75 0 0 1 1.06 0L10 10.608l4.382-4.383a.75.75 0 1 1 1.06 1.06l-4.911 4.912a.75.75 0 0 1-1.062 0L4.558 7.285a.75.75 0 0 1 0-1.06Z"
        fill={color}
      />
    </Svg>
  );
}
