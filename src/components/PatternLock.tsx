import React, { useState, useRef } from 'react';
import { View, PanResponder } from 'react-native';
import { GRID_SIZE } from '../constants';
import { styles } from '../styles';

export const PatternLock = ({ onComplete }: { onComplete: (pass: string) => void }) => {
  const [pattern, setPattern] = useState<number[]>([]);
  const patternRef = useRef<number[]>([]);

  const nodes = Array.from({ length: 9 }).map((_, i) => ({
    id: i,
    x: (i % 3) * GRID_SIZE + GRID_SIZE / 2,
    y: Math.floor(i / 3) * GRID_SIZE + GRID_SIZE / 2,
  }));

  const getPoint = (x: number, y: number) => {
    for (let node of nodes) {
      if (Math.hypot(node.x - x, node.y - y) < 40) return node.id;
    }
    return null;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const pt = getPoint(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        const initialPattern = pt !== null ? [pt] : [];
        patternRef.current = initialPattern;
        setPattern(initialPattern);
      },
      onPanResponderMove: (evt) => {
        const pt = getPoint(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        if (pt !== null) {
          if (!patternRef.current.includes(pt)) {
            patternRef.current = [...patternRef.current, pt];
            setPattern(patternRef.current);
          }
        }
      },
      onPanResponderRelease: () => {
        onComplete(patternRef.current.join(''));
      }
    })
  ).current;

  return (
    <View style={styles.patternContainer} {...panResponder.panHandlers}>
      {pattern.map((nodeId, index) => {
        if (index === pattern.length - 1) return null;
        const p1 = nodes[nodeId];
        const p2 = nodes[pattern[index + 1]];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        return (
          <View
            key={`line-${index}`}
            style={[
              styles.patternLine,
              {
                left: (p1.x + p2.x) / 2 - len / 2,
                top: (p1.y + p2.y) / 2 - 2,
                width: len,
                transform: [{ rotate: `${angle}deg` }]
              }
            ]}
          />
        );
      })}
      
      {nodes.map(node => (
        <View key={node.id} style={[styles.patternNodeBase, { left: node.x - 25, top: node.y - 25 }]}>
          <View style={[styles.patternNodeInner, pattern.includes(node.id) && styles.patternNodeActive]} />
        </View>
      ))}
    </View>
  );
};