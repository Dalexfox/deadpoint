/**
 * StartHoldPicker — full-screen, pinch-to-zoom photo viewer for marking the
 * starting hold of a climb. Shared by both Screen-1 log entries
 * (`(tabs)/log.tsx` + `gym/[id]/log.tsx`).
 *
 * Zoom/pan uses a native iOS-zoomable ScrollView (maximumZoomScale +
 * pinchGestureEnabled). The tappable layer is a child sized to the *content*
 * rect, so a tap's locationX/Y are in the content's own (pre-zoom) coordinate
 * space — i.e. zoom-invariant — and map straight to 0–1 proportional image
 * coords. A tap snaps to the nearest detected hold box, exactly like the inline
 * picker did, but now you can zoom in first to place it precisely when several
 * same-colour holds sit close together.
 */
import { useEffect, useState } from 'react';
import {
  Modal, View, Text, Image, Pressable, ScrollView, StyleSheet,
  TouchableOpacity, useWindowDimensions, type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BoundingBox } from '../lib/holdDetection';

const NEAR_BLACK = '#0d0a05';
const SAND       = '#c8a84a';

type Point = { x: number; y: number };

export function StartHoldPicker({
  visible, photoUri, boxes, initial, onCancel, onConfirm,
}: {
  visible: boolean;
  photoUri: string | null;
  boxes: BoundingBox[];
  initial: Point | null;
  onCancel: () => void;
  onConfirm: (point: Point | null) => void;
}) {
  const { width: winW } = useWindowDimensions();
  const [aspect, setAspect] = useState(1);                       // image width / height
  const [area, setArea]     = useState({ width: winW, height: winW });
  const [point, setPoint]   = useState<Point | null>(initial);

  // Reset the working selection to whatever was already set each time it opens.
  useEffect(() => { if (visible) setPoint(initial); }, [visible, initial]);

  // Natural aspect ratio so we can fit (contain) the whole photo on screen.
  useEffect(() => {
    if (!photoUri) return;
    let active = true;
    Image.getSize(photoUri, (w, h) => { if (active && h > 0) setAspect(w / h); }, () => {});
    return () => { active = false; };
  }, [photoUri]);

  // Fit the image inside the available stage (contain — show the whole climb).
  const fitByWidth = area.width / aspect <= area.height;
  const contentW = fitByWidth ? area.width : area.height * aspect;
  const contentH = fitByWidth ? area.width / aspect : area.height;

  // Snap a proportional tap to the nearest detected hold's centre.
  const snap = (x: number, y: number): Point => {
    if (boxes.length === 0) return { x, y };
    let best = boxes[0], bestD = Infinity;
    for (const b of boxes) {
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bestD) { bestD = d; best = b; }
    }
    return { x: best.x + best.width / 2, y: best.y + best.height / 2 };
  };

  const handleTap = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const x = Math.max(0, Math.min(1, locationX / contentW));
    const y = Math.max(0, Math.min(1, locationY / contentH));
    setPoint(snap(x, y));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={st.container}>
        <SafeAreaView edges={['top']}>
          <View style={st.header}>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={st.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={st.title}>Start hold</Text>
            <TouchableOpacity
              onPress={() => setPoint(null)}
              disabled={!point}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[st.clear, !point && st.clearDisabled]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <View
          style={st.stage}
          onLayout={e => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
          {photoUri && (
            <ScrollView
              style={StyleSheet.absoluteFill}
              contentContainerStyle={st.scrollContent}
              maximumZoomScale={6}
              minimumZoomScale={1}
              pinchGestureEnabled
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              bouncesZoom>
              <View style={{ width: contentW, height: contentH }}>
                <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                {boxes.map((b, i) => (
                  <View
                    key={i}
                    pointerEvents="none"
                    style={[st.box, {
                      left:   b.x      * contentW,
                      top:    b.y      * contentH,
                      width:  b.width  * contentW,
                      height: b.height * contentH,
                    }]}
                  />
                ))}
                {/* Tap layer — child of the content rect, so locationX/Y are zoom-invariant. */}
                <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />
                {point && (
                  <View
                    pointerEvents="none"
                    style={[st.ring, { left: point.x * contentW, top: point.y * contentH }]}
                  />
                )}
              </View>
            </ScrollView>
          )}
        </View>

        <SafeAreaView edges={['bottom']} style={st.footer}>
          <Text style={st.hint}>
            {point ? 'Start hold set · pinch to zoom · tap to adjust' : 'Pinch to zoom · tap your starting hold'}
          </Text>
          <TouchableOpacity style={st.doneBtn} onPress={() => onConfirm(point)} activeOpacity={0.85}>
            <Text style={st.doneText}>Done</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: NEAR_BLACK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  cancel: { fontSize: 15, fontFamily: 'SpaceGrotesk_600SemiBold', color: 'rgba(255,255,255,0.7)' },
  title:  { fontSize: 16, fontFamily: 'Syne_800ExtraBold', color: '#ffffff', letterSpacing: -0.3 },
  clear:  { fontSize: 15, fontFamily: 'SpaceGrotesk_600SemiBold', color: SAND },
  clearDisabled: { color: 'rgba(255,255,255,0.25)' },
  stage: { flex: 1, overflow: 'hidden' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: SAND,
    borderRadius: 6,
    backgroundColor: 'rgba(200,168,74,0.15)',
  },
  ring: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    marginLeft: -17,
    marginTop: -17,
    borderWidth: 3,
    borderColor: SAND,
    backgroundColor: 'rgba(200,168,74,0.3)',
  },
  footer: { paddingHorizontal: 18, paddingTop: 10 },
  hint: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 10,
  },
  doneBtn: {
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneText: { fontSize: 15, fontFamily: 'Syne_800ExtraBold', color: '#ffffff', letterSpacing: -0.3 },
});
