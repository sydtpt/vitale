import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Matches the pill layout in (tabs)/_layout.tsx:
// bottom = Math.max(insets.bottom, 16) + 8
// pill height ≈ row padding (16) + tabInner padding (16) + icon (22) + gap (3) + label (12) ≈ 69px
const TAB_PILL_HEIGHT = 70;

export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 16) + 8 + TAB_PILL_HEIGHT + 8;
}
