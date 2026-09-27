import * as topojson from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';
import { Stay } from '../types';
import { parseCoordinateForCountry } from '../components/TravelGlobe';

// Extract land features and country borders once
const topology = worldData as any;
const worldLand = topojson.feature(topology, topology.objects.land) as any;
const worldBorders = topojson.mesh(topology, topology.objects.countries, (a: any, b: any) => a !== b) as any;

export interface MapBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapRenderOptions {
  theme?: 'vintage' | 'dark';
  showFlightArcs?: boolean;
  showPins?: boolean;
  showGraticules?: boolean;
}

/**
 * Projects longitude and latitude onto a 2D bounding box
 * Uses equirectangular / natural bounded projection covering major world landmasses
 */
export function projectMapCoord(
  lng: number,
  lat: number,
  box: MapBoundingBox
): { x: number; y: number } {
  // Longitude range: -170° (Pacific / Americas) to +175° (East Asia / Oceania)
  const minLng = -170;
  const maxLng = 175;
  // Latitude range: -55° (Southern tip) to +75° (Arctic / Scandinavia)
  const minLat = -55;
  const maxLat = 75;

  const normX = Math.max(0, Math.min(1, (lng - minLng) / (maxLng - minLng)));
  const normY = Math.max(0, Math.min(1, 1 - (lat - minLat) / (maxLat - minLat)));

  return {
    x: box.x + normX * box.width,
    y: box.y + normY * box.height,
  };
}

/**
 * Draws a real geographic world map background with continents, country borders,
 * and user travel trajectory arcs and city nodes.
 */
export function drawWorldTrajectoryMap(
  ctx: CanvasRenderingContext2D,
  stays: Stay[],
  box: MapBoundingBox,
  options: MapRenderOptions = {}
): void {
  const {
    theme = 'vintage',
    showFlightArcs = true,
    showPins = true,
    showGraticules = true,
  } = options;

  const isDark = theme === 'dark';

  // Color Palette
  const colors = isDark
    ? {
        ocean: '#0D111A',
        graticule: 'rgba(255, 255, 255, 0.05)',
        land: '#182030',
        coastline: '#28354E',
        borders: 'rgba(255, 255, 255, 0.09)',
        arc: '#3B82F6',
        arcGlow: 'rgba(59, 130, 246, 0.25)',
        pinHalo: 'rgba(59, 130, 246, 0.25)',
        pinCore: '#60A5FA',
        pinBorder: '#FFFFFF',
        textBadgeBg: 'rgba(15, 23, 42, 0.88)',
        textBadgeBorder: '#334155',
        textColor: '#F1F5F9',
      }
    : {
        ocean: '#F5EFE6',
        graticule: 'rgba(140, 128, 112, 0.16)',
        land: '#E8DFD3',
        coastline: '#C4B9AA',
        borders: 'rgba(180, 170, 155, 0.65)',
        arc: '#035096',
        arcGlow: 'rgba(3, 80, 150, 0.18)',
        pinHalo: 'rgba(3, 80, 150, 0.18)',
        pinCore: '#035096',
        pinBorder: '#FFFFFF',
        textBadgeBg: 'rgba(255, 255, 255, 0.92)',
        textBadgeBorder: '#D5CDC0',
        textColor: '#2C251D',
      };

  ctx.save();

  // 1. Clip to container box
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();

  // 2. Draw Ocean Background
  ctx.fillStyle = colors.ocean;
  ctx.fillRect(box.x, box.y, box.width, box.height);

  // 3. Draw Graticules (Equator, Tropics, Meridians)
  if (showGraticules) {
    ctx.strokeStyle = colors.graticule;
    ctx.lineWidth = 0.8;

    // Equator (0° Lat)
    const eq = projectMapCoord(0, 0, box);
    ctx.beginPath();
    ctx.moveTo(box.x, eq.y);
    ctx.lineTo(box.x + box.width, eq.y);
    ctx.stroke();

    // Tropics (±23.5° Lat)
    const tropicCancer = projectMapCoord(0, 23.5, box);
    const tropicCapri = projectMapCoord(0, -23.5, box);
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(box.x, tropicCancer.y);
    ctx.lineTo(box.x + box.width, tropicCancer.y);
    ctx.moveTo(box.x, tropicCapri.y);
    ctx.lineTo(box.x + box.width, tropicCapri.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Prime Meridian & Longitudinal Grid Lines
    [-120, -60, 0, 60, 120].forEach((deg) => {
      const p = projectMapCoord(deg, 0, box);
      ctx.beginPath();
      ctx.moveTo(p.x, box.y);
      ctx.lineTo(p.x, box.y + box.height);
      ctx.stroke();
    });
  }

  // 4. Draw World Continents & Landmasses
  ctx.fillStyle = colors.land;
  ctx.strokeStyle = colors.coastline;
  ctx.lineWidth = 0.9;

  if (worldLand && worldLand.features) {
    worldLand.features.forEach((feature: any) => {
      const coords = feature.geometry?.coordinates || [];
      coords.forEach((polygon: any) => {
        polygon.forEach((ring: any) => {
          ctx.beginPath();
          ring.forEach(([lng, lat]: [number, number], i: number) => {
            const pt = projectMapCoord(lng, lat, box);
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      });
    });
  }

  // 5. Draw National Country Boundaries
  if (worldBorders && worldBorders.coordinates) {
    ctx.strokeStyle = colors.borders;
    ctx.lineWidth = 0.6;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    worldBorders.coordinates.forEach((segment: any) => {
      segment.forEach(([lng, lat]: [number, number], i: number) => {
        const pt = projectMapCoord(lng, lat, box);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 6. Chronological Stays Processing & Trajectory Arcs
  const chronStays = [...stays].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const mappedPts = chronStays.map((s, idx) => {
    const coords = parseCoordinateForCountry(s.country, s.city);
    const pt = projectMapCoord(coords.lng, coords.lat, box);
    return {
      ...s,
      lat: coords.lat,
      lng: coords.lng,
      x: pt.x,
      y: pt.y,
      index: idx + 1,
    };
  });

  // Flight Arcs
  if (showFlightArcs && mappedPts.length > 1) {
    // Outer arc glow
    ctx.strokeStyle = colors.arcGlow;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    for (let i = 1; i < mappedPts.length; i++) {
      const prev = mappedPts[i - 1];
      const curr = mappedPts[i];
      const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const cx = (prev.x + curr.x) / 2;
      const cy = (prev.y + curr.y) / 2 - Math.min(55, Math.max(15, dist * 0.18));
      ctx.moveTo(prev.x, prev.y);
      ctx.quadraticCurveTo(cx, cy, curr.x, curr.y);
    }
    ctx.stroke();

    // Primary dashed flight trajectory line
    ctx.strokeStyle = colors.arc;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    for (let i = 1; i < mappedPts.length; i++) {
      const prev = mappedPts[i - 1];
      const curr = mappedPts[i];
      const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const cx = (prev.x + curr.x) / 2;
      const cy = (prev.y + curr.y) / 2 - Math.min(55, Math.max(15, dist * 0.18));
      ctx.moveTo(prev.x, prev.y);
      ctx.quadraticCurveTo(cx, cy, curr.x, curr.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 7. Destination City Pins & Anti-Collision Labels
  if (showPins) {
    const scale = Math.max(0.85, Math.min(3.2, box.width / 750));
    const fontSize = Math.round(9 * scale);
    const pillH = Math.round(15 * scale);
    const pinR = Math.max(3.5, 4.5 * scale);
    const haloR = Math.max(8.5, 11 * scale);

    // Deduplicate/group pins at virtually identical geographic coordinates (< 5px)
    interface DistinctPinNode {
      id: number;
      country: string;
      city: string;
      x: number;
      y: number;
      indices: number[];
      labelText: string;
    }

    const pinNodes: DistinctPinNode[] = [];
    mappedPts.forEach((p) => {
      const existing = pinNodes.find(
        (n) => Math.hypot(n.x - p.x, n.y - p.y) < 5 * scale
      );
      if (existing) {
        if (!existing.indices.includes(p.index)) {
          existing.indices.push(p.index);
        }
      } else {
        pinNodes.push({
          id: pinNodes.length,
          country: p.country,
          city: p.city,
          x: p.x,
          y: p.y,
          indices: [p.index],
          labelText: `${p.country}·${p.city}`,
        });
      }
    });

    // Solve collision-free label placements
    interface PlacedLabel {
      node: DistinctPinNode;
      x: number;
      y: number;
      w: number;
      h: number;
      pinX: number;
      pinY: number;
      anchorX: number;
      anchorY: number;
      hasLeaderLine: boolean;
    }

    ctx.font = `500 ${fontSize}px "Fredoka", "Space Grotesk", sans-serif`;
    const padH = Math.round(6 * scale);
    const margin = Math.max(3, Math.round(3 * scale));

    const measured = pinNodes.map((node) => {
      const textW = ctx.measureText(node.labelText).width;
      const extraMultiplierW = node.indices.length > 1 ? 16 * scale : 0;
      const w = Math.round(textW + padH * 2 + extraMultiplierW);
      return { node, w, h: pillH };
    });

    // Calculate cluster density so dense geographic hubs (e.g. Central Europe, Japan) are placed with priority
    const density = measured.map((item, i) => {
      let neighbors = 0;
      for (let j = 0; j < measured.length; j++) {
        if (i !== j) {
          const d = Math.hypot(item.node.x - measured[j].node.x, item.node.y - measured[j].node.y);
          if (d < 100 * scale) neighbors++;
        }
      }
      return { item, neighbors };
    });
    density.sort((a, b) => b.neighbors - a.neighbors);

    const placedLabels: PlacedLabel[] = [];

    const getOverlapArea = (x: number, y: number, w: number, h: number): number => {
      let total = 0;
      for (const p of placedLabels) {
        const ox = Math.max(0, Math.min(x + w, p.x + p.w) - Math.max(x, p.x));
        const oy = Math.max(0, Math.min(y + h, p.y + p.h) - Math.max(y, p.y));
        if (ox > 0 && oy > 0) total += ox * oy;
      }
      return total;
    };

    const pinCollision = (x: number, y: number, w: number, h: number): boolean => {
      for (const m of measured) {
        const r = 6 * scale;
        if (
          m.node.x >= x - r &&
          m.node.x <= x + w + r &&
          m.node.y >= y - r &&
          m.node.y <= y + h + r
        ) {
          return true;
        }
      }
      return false;
    };

    const distanceTiers = [
      { tier: 1, dist: 14 * scale },
      { tier: 2, dist: 28 * scale },
      { tier: 3, dist: 46 * scale },
      { tier: 4, dist: 66 * scale },
      { tier: 5, dist: 90 * scale },
    ];

    for (const { item } of density) {
      const { node, w, h } = item;
      const px = node.x;
      const py = node.y;

      interface Candidate {
        x: number;
        y: number;
        tier: number;
        cost: number;
      }

      const candidates: Candidate[] = [];

      for (const { tier, dist } of distanceTiers) {
        const angleOffsets = [
          // Top-Right (default primary)
          { x: px + 8 * scale, y: py - h - dist * 0.5, pref: 0 },
          // Top-Left
          { x: px - w - 8 * scale, y: py - h - dist * 0.5, pref: 3 },
          // Directly North
          { x: px - w / 2, y: py - h - dist - 4 * scale, pref: 2 },
          // Bottom-Right
          { x: px + 8 * scale, y: py + dist * 0.5, pref: 5 },
          // Bottom-Left
          { x: px - w - 8 * scale, y: py + dist * 0.5, pref: 7 },
          // Directly South
          { x: px - w / 2, y: py + dist + 4 * scale, pref: 6 },
          // Far East
          { x: px + dist + 8 * scale, y: py - h / 2, pref: 8 },
          // Far West
          { x: px - w - dist - 8 * scale, y: py - h / 2, pref: 9 },
          // Diagonal tiers
          { x: px + dist * 0.75, y: py - h - dist * 0.8, pref: 10 },
          { x: px - w - dist * 0.75, y: py - h - dist * 0.8, pref: 11 },
          { x: px + dist * 0.75, y: py + dist * 0.8, pref: 12 },
          { x: px - w - dist * 0.75, y: py + dist * 0.8, pref: 13 },
        ];

        for (const cand of angleOffsets) {
          const cx = cand.x;
          const cy = cand.y;

          const outOfBounds =
            cx < box.x + 4 ||
            cy < box.y + 4 ||
            cx + w > box.x + box.width - 4 ||
            cy + h > box.y + box.height - 4;

          const overlapArea = getOverlapArea(cx, cy, w + margin, h + margin);
          const hitsPin = pinCollision(cx, cy, w, h);

          let cost = 0;
          if (outOfBounds) cost += 400000;
          if (overlapArea > 0) cost += 50000 + overlapArea * 150;
          if (hitsPin) cost += 15000;
          cost += tier * 25 + cand.pref * 3;
          cost += Math.hypot(cx + w / 2 - px, cy + h / 2 - py) * 0.1;

          candidates.push({ x: cx, y: cy, tier, cost });
        }
      }

      candidates.sort((a, b) => a.cost - b.cost);
      const best = candidates[0] || { x: px + 8 * scale, y: py - h - 14 * scale, tier: 1 };

      const clampedX = Math.max(box.x + 4, Math.min(box.x + box.width - w - 4, best.x));
      const clampedY = Math.max(box.y + 4, Math.min(box.y + box.height - h - 4, best.y));

      placedLabels.push({
        node,
        x: clampedX,
        y: clampedY,
        w,
        h,
        pinX: px,
        pinY: py,
        anchorX: 0,
        anchorY: 0,
        hasLeaderLine: false,
      });
    }

    // Repulsion relaxation to remove any remaining overlaps
    for (let pass = 0; pass < 25; pass++) {
      let moved = false;
      for (let i = 0; i < placedLabels.length; i++) {
        for (let j = i + 1; j < placedLabels.length; j++) {
          const a = placedLabels[i];
          const b = placedLabels[j];

          const minSepX = (a.w + b.w) / 2 + margin;
          const minSepY = (a.h + b.h) / 2 + margin;

          const diffX = (b.x + b.w / 2) - (a.x + a.w / 2);
          const diffY = (b.y + b.h / 2) - (a.y + a.h / 2);

          const overlapX = minSepX - Math.abs(diffX);
          const overlapY = minSepY - Math.abs(diffY);

          if (overlapX > 0 && overlapY > 0) {
            moved = true;
            if (overlapX < overlapY) {
              const shift = (overlapX / 2) + 0.5;
              if (diffX >= 0) {
                a.x -= shift;
                b.x += shift;
              } else {
                a.x += shift;
                b.x += shift;
              }
            } else {
              const shift = (overlapY / 2) + 0.5;
              if (diffY >= 0) {
                a.y -= shift;
                b.y += shift;
              } else {
                a.y += shift;
                b.y += shift;
              }
            }
          }
        }
        placedLabels[i].x = Math.max(box.x + 4, Math.min(box.x + box.width - placedLabels[i].w - 4, placedLabels[i].x));
        placedLabels[i].y = Math.max(box.y + 4, Math.min(box.y + box.height - placedLabels[i].h - 4, placedLabels[i].y));
      }
      if (!moved) break;
    }

    // Calculate leader lines for labels offset from pins
    placedLabels.forEach((item) => {
      const boxCenterX = item.x + item.w / 2;
      const boxCenterY = item.y + item.h / 2;
      const dist = Math.hypot(boxCenterX - item.pinX, boxCenterY - item.pinY);

      if (dist > 15 * scale) {
        item.hasLeaderLine = true;
        item.anchorX = Math.max(item.x, Math.min(item.x + item.w, item.pinX));
        item.anchorY = Math.max(item.y, Math.min(item.y + item.h, item.pinY));
      } else {
        item.hasLeaderLine = false;
      }
    });

    // 1. Draw Leader Lines first (clean underneath pills)
    placedLabels.forEach((item) => {
      if (item.hasLeaderLine) {
        ctx.save();
        ctx.strokeStyle = isDark ? 'rgba(96, 165, 250, 0.45)' : 'rgba(3, 80, 150, 0.38)';
        ctx.lineWidth = Math.max(0.75, 0.9 * scale);
        ctx.setLineDash([2.5 * scale, 2.5 * scale]);
        ctx.beginPath();
        ctx.moveTo(item.pinX, item.pinY);
        ctx.lineTo(item.anchorX, item.anchorY);
        ctx.stroke();

        ctx.fillStyle = isDark ? '#60A5FA' : '#035096';
        ctx.beginPath();
        ctx.arc(item.anchorX, item.anchorY, 1.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // 2. Draw Destination Pins
    pinNodes.forEach((p) => {
      // Glow halo
      ctx.fillStyle = colors.pinHalo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
      ctx.fill();

      // Pin core
      ctx.fillStyle = colors.pinCore;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pinR, 0, Math.PI * 2);
      ctx.fill();

      // Crisp border ring
      ctx.strokeStyle = colors.pinBorder;
      ctx.lineWidth = Math.max(1.2, 1.5 * scale);
      ctx.stroke();

      // Center sequence or index dot
      if (p.indices.length === 1 && scale >= 1.2) {
        ctx.fillStyle = colors.pinBorder;
        ctx.font = `bold ${Math.round(6.5 * scale)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${p.indices[0]}`, p.x, p.y);
      }
    });

    // 3. Draw Non-Overlapping Label Badges
    placedLabels.forEach((item) => {
      // Pill backdrop
      ctx.fillStyle = colors.textBadgeBg;
      ctx.fillRect(item.x, item.y, item.w, item.h);
      ctx.strokeStyle = colors.textBadgeBorder;
      ctx.lineWidth = Math.max(0.6, 0.8 * scale);
      ctx.strokeRect(item.x, item.y, item.w, item.h);

      // Text label
      ctx.fillStyle = colors.textColor;
      ctx.font = `500 ${fontSize}px "Fredoka", "Space Grotesk", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.node.labelText, item.x + 6 * scale, item.y + item.h / 2);

      // Multiplier tag if visited multiple times
      if (item.node.indices.length > 1) {
        ctx.fillStyle = colors.pinCore;
        ctx.font = `bold ${Math.max(7, Math.round(7.5 * scale))}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(`×${item.node.indices.length}`, item.x + item.w - 4 * scale, item.y + item.h / 2);
      }
    });
  }

  ctx.restore();
}

/**
 * Creates an ultra-sharp offscreen canvas (300 DPI) rendering of the world trajectory map
 */
export function createHighResWorldMapCanvas(
  stays: Stay[],
  width: number = 2400,
  height: number = 1400,
  theme: 'vintage' | 'dark' = 'vintage'
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw full canvas map
  drawWorldTrajectoryMap(ctx, stays, { x: 0, y: 0, width, height }, { theme });
  return canvas;
}
