/**
 * Character page — read-only character sheet. Points are spent only through Level Up
 * (tree node → Level Up screen) or the Creator. Dev mode adds the identity editor and the rule checks.
 *
 * Layout:  top bar  [ Identity | Affinities | Stats (HP + pools + icons + rest) | Hit Die | Points ]   topbar/
 *          body     [ Attributes / Skills | Gear | Equipment ]  — three equal thirds
 *          dev      [ Identity | Checks ]  (Dev mode only)                                             DevCards.tsx
 * Colours follow the core class (CLASS_THEME in config/settings.ts).
 */
import type { ShopMode } from "@/features/equipment/shop/EquipmentDrawer";
import { EquipmentPanel } from "@/features/equipment/components/EquipmentPanel";
import { GearPanel } from "@/features/equipment/components/GearPanel";
import { classStyle } from "@/ui";
import { AttributesCard } from "./AttributesCard";
import { ChecksCard, DevIdentityCard } from "./DevCards";
import { SkillsCard } from "./SkillsCard";
import { AffinitiesSection } from "./topbar/AffinitiesSection";
import { IdentitySection } from "./topbar/IdentitySection";
import { HitDieSection, PointsSection } from "./topbar/PointsSections";
import { StatsSection } from "./topbar/StatsSection";
import type { SheetProps } from "./types";

export function CharacterPage(p: SheetProps & {
  devMode: boolean; onCreate: () => void; onLevelUp: () => void; onShop: (m: ShopMode) => void; onMessage?: (m: string) => void;
}) {
  const { rules, sh, ch, c, devMode, onMessage } = p;
  return (
    <div className="char" style={classStyle(ch.className)}>
      <header className="char-top">
        <IdentitySection {...p} />
        <AffinitiesSection {...p} />
        <StatsSection {...p} />
        <HitDieSection {...p} />
        <PointsSection ch={ch} c={c} />
      </header>

      <div className="char__thirds">
        <div className="char__third">
          <AttributesCard {...p} />
          <SkillsCard rules={rules} c={c} />
        </div>
        <div className="char__third">
          <GearPanel sh={sh} c={c} devMode={devMode} onMessage={onMessage} />
        </div>
        <div className="char__third">
          <EquipmentPanel sh={sh} c={c} rules={rules} devMode={devMode} onShop={p.onShop} onMessage={onMessage} />
        </div>
      </div>

      {devMode && (
        <div className="char__dev">
          <DevIdentityCard rules={rules} sh={sh} ch={ch} />
          <ChecksCard c={c} />
        </div>
      )}
    </div>
  );
}
