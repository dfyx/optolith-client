import * as React from "react";
import { equals } from "../../../Data/Eq";
import { fmap } from "../../../Data/Functor";
import { flength, imap, intercalate, isList, List, map } from "../../../Data/List";
import { bindF, elem, ensure, fromJust, isJust, isNothing, Just, mapMaybe, Maybe, maybe, or } from "../../../Data/Maybe";
import { elems, lookup, lookupF, OrderedMap } from "../../../Data/OrderedMap";
import { Record } from "../../../Data/Record";
import { fst, isTuple, snd } from "../../../Data/Tuple";
import { EditItem } from "../../Models/Hero/EditItem";
import { EditPrimaryAttributeDamageThreshold } from "../../Models/Hero/EditPrimaryAttributeDamageThreshold";
import { Attribute } from "../../Models/Wiki/Attribute";
import { CombatTechnique } from "../../Models/Wiki/CombatTechnique";
import { L10nRecord } from "../../Models/Wiki/L10n";
import { translate } from "../../Utilities/I18n";
import { ItemEditorInputValidation } from "../../Utilities/itemEditorInputValidationUtils";
import { getLossLevelElements } from "../../Utilities/ItemUtils";
import { pipe, pipe_ } from "../../Utilities/pipe";
import { isString } from "../../Utilities/typeCheckUtils";
import { Checkbox } from "../Universal/Checkbox";
import { Dropdown, DropdownOption } from "../Universal/Dropdown";
import { Hr } from "../Universal/Hr";
import { Label } from "../Universal/Label";
import { TextField } from "../Universal/TextField";

export interface ItemEditorMeleeSectionProps {
  attributes: OrderedMap<string, Record<Attribute>>
  combatTechniques: OrderedMap<string, Record<CombatTechnique>>
  item: Record<EditItem>
  l10n: L10nRecord
  inputValidation: Record<ItemEditorInputValidation>
  setCombatTechnique (id: string): void
  setDamageDiceNumber (value: string): void
  setDamageDiceSides (value: number): void
  setDamageFlat (value: string): void
  setPrimaryAttribute (primary: Maybe<string>): void
  setDamageThreshold (value: string): void
  setFirstDamageThreshold (value: string): void
  setSecondDamageThreshold (value: string): void
  switchIsDamageThresholdSeparated (): void
  setAttack (value: string): void
  setParry (value: string): void
  setReach (id: number): void
  setLength (value: string): void
  setStructurePoints (value: string): void
  setStabilityModifier (value: string): void
  switchIsParryingWeapon (): void
  switchIsTwoHandedWeapon (): void
  setLoss (id: Maybe<number>): void
}

const EIA = EditItem.A
const IEIVA = ItemEditorInputValidation.A
const EPADTA = EditPrimaryAttributeDamageThreshold.A
const CTA = CombatTechnique.A
const AA = Attribute.A

const shortOrEmpty =
  (attrs: OrderedMap<string, Record<Attribute>>) => pipe (lookupF (attrs), maybe ("") (AA.short))

export function ItemEditorMeleeSection (props: ItemEditorMeleeSectionProps) {
  const { attributes, combatTechniques, inputValidation, item, l10n } = props

  const dice =
    map ((id: number) => DropdownOption ({
                                           id: Just (id),
                                           name: `${translate (l10n) ("dice.short")}${id}`,
                                        }))
        (List (2, 3, 6))

  const gr = EIA.gr (item)
  const locked = EIA.isTemplateLocked (item)
  const combatTechnique = EIA.combatTechnique (item)
  const damageBonusThreshold = pipe_ (item, EIA.damageBonus, EPADTA.threshold)

  const lockedByNoCombatTechniqueOrLances =
    locked
    || !isJust (combatTechnique)
    || fromJust (combatTechnique) === "CT_7"

  return (gr === 1 || elem (1) (EIA.improvisedWeaponGroup (item)))
    ? (
      <>
        <Hr className="vertical" />
        <div className="melee">
          <div className="row">
            <Dropdown
              className="combattechnique"
              label={translate (l10n) ("combattechnique")}
              hint={translate (l10n) ("none")}
              value={combatTechnique}
              options={pipe_ (
                combatTechniques,
                elems,
                mapMaybe (pipe (
                  ensure (pipe (CTA.gr, equals (1))),
                  fmap (x => DropdownOption ({ id: Just (CTA.id (x)), name: CTA.name (x) }))
                ))
              )}
              onChangeJust={props.setCombatTechnique}
              disabled={locked}
              required
              />
          </div>
          <div className="row">
            <Dropdown
              className="primary-attribute-selection"
              label={translate (l10n) ("primaryattribute")}
              value={pipe_ (item, EIA.damageBonus, EPADTA.primary)}
              options={List (
                DropdownOption ({
                  name: `${translate (l10n) ("primaryattribute.short")} (${
                    pipe_ (
                      combatTechnique,
                      bindF (lookupF (combatTechniques)),
                      maybe ("")
                            (pipe (
                              CTA.primary,
                              mapMaybe (pipe (lookupF (attributes), fmap (AA.short))),
                              intercalate ("/")
                            ))
                    )
                  })`,
                }),
                DropdownOption ({
                  id: Just ("ATTR_5"),
                  name: shortOrEmpty (attributes) ("ATTR_5"),
                }),
                DropdownOption ({
                  id: Just ("ATTR_6"),
                  name: shortOrEmpty (attributes) ("ATTR_6"),
                }),
                DropdownOption ({
                  id: Just ("ATTR_6_8"),
                  name: `${
                    shortOrEmpty (attributes) ("ATTR_6")
                  }/${
                    shortOrEmpty (attributes) ("ATTR_8")
                  }`,
                }),
                DropdownOption ({
                  id: Just ("ATTR_8"),
                  name: shortOrEmpty (attributes) ("ATTR_8"),
                })
              )}
              onChange={props.setPrimaryAttribute}
              disabled={lockedByNoCombatTechniqueOrLances}
              />
            {
              isTuple (damageBonusThreshold)
                ? (
                  <div className="container damage-threshold">
                    <Label
                      text={translate (l10n) ("damagethreshold")}
                      disabled={lockedByNoCombatTechniqueOrLances}
                      />
                    <TextField
                      className="damage-threshold-part"
                      value={fst (damageBonusThreshold)}
                      onChangeString={props.setFirstDamageThreshold}
                      disabled={lockedByNoCombatTechniqueOrLances}
                      valid={IEIVA.firstDamageThreshold (inputValidation)}
                      />
                    <TextField
                      className="damage-threshold-part"
                      value={snd (damageBonusThreshold)}
                      onChangeString={props.setSecondDamageThreshold}
                      disabled={lockedByNoCombatTechniqueOrLances}
                      valid={IEIVA.secondDamageThreshold (inputValidation)}
                      />
                  </div>
                )
                : (
                  <TextField
                    className="damage-threshold"
                    label={translate (l10n) ("damagethreshold")}
                    value={damageBonusThreshold}
                    onChangeString={props.setDamageThreshold}
                    disabled={lockedByNoCombatTechniqueOrLances}
                    valid={IEIVA.damageThreshold (inputValidation)}
                    />
                )
            }
          </div>
          <div className="row">
            <Checkbox
              className="damage-threshold-separated"
              label={translate (l10n) ("separatedamagethresholds")}
              checked={isList (damageBonusThreshold)}
              onClick={props.switchIsDamageThresholdSeparated}
              disabled={
                locked
                || isNothing (combatTechnique)
                || !(
                  isString (damageBonusThreshold)
                  && damageBonusThreshold === "ATTR_6_8"
                  || pipe_ (
                      combatTechniques,
                      lookup (fromJust (combatTechnique)),
                      fmap (pipe (
                        CTA.primary,
                        flength,
                        equals (2)
                      )),
                      or
                    )
                )
                || fromJust (combatTechnique) === "CT_7"
              }
              />
          </div>
          <div className="row">
            <div className="container">
              <Label text={translate (l10n) ("damage")} disabled={locked} />
              <TextField
                className="damage-dice-number"
                value={EIA.damageDiceNumber (item)}
                onChangeString={props.setDamageDiceNumber}
                disabled={locked}
                valid={IEIVA.damageDiceNumber (inputValidation)}
                />
              <Dropdown
                className="damage-dice-sides"
                hint={translate (l10n) ("dice.short")}
                value={EIA.damageDiceSides (item)}
                options={dice}
                onChangeJust={props.setDamageDiceSides}
                disabled={locked}
                />
              <TextField
                className="damage-flat"
                value={EIA.damageFlat (item)}
                onChangeString={props.setDamageFlat}
                disabled={locked}
                valid={IEIVA.damageFlat (inputValidation)}
                />
            </div>
            <TextField
              className="stabilitymod"
              label={translate (l10n) ("breakingpointratingmodifier.short")}
              value={EIA.stabilityMod (item)}
              onChangeString={props.setStabilityModifier}
              disabled={locked}
              valid={IEIVA.stabilityMod (inputValidation)}
              />
            <Dropdown
              className="weapon-loss"
              label={translate (l10n) ("damaged.short")}
              value={EIA.loss (item)}
              options={getLossLevelElements ()}
              onChange={props.setLoss}
              />
          </div>
          <div className="row">
            <Dropdown
              className="reach"
              label={translate (l10n) ("reach")}
              hint={translate (l10n) ("none")}
              value={EIA.reach (item)}
              options={imap (i => (name: string) => DropdownOption ({ id: Just (i + 1), name }))
                            (translate (l10n) ("reachlabels"))}
              onChangeJust={props.setReach}
              disabled={locked || elem ("CT_7") (combatTechnique)}
              required
              />
            <div className="container">
              <Label
                text={translate (l10n) ("attackparrymodifier.short")}
                disabled={locked || elem ("CT_7") (combatTechnique)}
                />
              <TextField
                className="at"
                value={EIA.at (item)}
                onChangeString={props.setAttack}
                disabled={locked || elem ("CT_7") (combatTechnique)}
                valid={IEIVA.at (inputValidation)}
              />
            <TextField
              className="pa"
              value={EIA.pa (item)}
              onChangeString={props.setParry}
              disabled={
                locked
                || elem ("CT_6") (combatTechnique)
                || elem ("CT_7") (combatTechnique)
              }
              valid={IEIVA.pa (inputValidation)}
              />
          </div>
          {
            elem ("CT_10") (combatTechnique)
              ? (
                <TextField
                  className="stp"
                  label={translate (l10n) ("structurepoints.short")}
                  value={EIA.stp (item)}
                  onChangeString={props.setStructurePoints}
                  disabled={locked}
                  />
              )
              : (
                <TextField
                  className="length"
                  label={translate (l10n) ("length")}
                  value={EIA.length (item)}
                  onChangeString={props.setLength}
                  disabled={locked}
                  valid={IEIVA.length (inputValidation)}
                  />
              )
          }
        </div>
        <div className="row">
          <Checkbox
            className="parrying-weapon"
            label={translate (l10n) ("parryingweapon")}
            checked={EIA.isParryingWeapon (item)}
            onClick={props.switchIsParryingWeapon}
            disabled={locked}
            />
          <Checkbox
            className="twohanded-weapon"
            label={translate (l10n) ("twohandedweapon")}
            checked={!EIA.isTwoHandedWeapon (item)}
            onClick={props.switchIsTwoHandedWeapon}
            disabled={locked}
            />
        </div>
      </div>
    </>
  )
  : null
}
