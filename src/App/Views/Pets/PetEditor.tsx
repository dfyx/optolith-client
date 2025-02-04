import * as React from "react";
import { fmap } from "../../../Data/Functor";
import { fromJust, isJust, isNothing, Maybe } from "../../../Data/Maybe";
import { lookupF } from "../../../Data/OrderedMap";
import { Record } from "../../../Data/Record";
import { EditPet } from "../../Models/Hero/EditPet";
import { Attribute } from "../../Models/Wiki/Attribute";
import { L10nRecord } from "../../Models/Wiki/L10n";
import { WikiModel } from "../../Models/Wiki/WikiModel";
import { translate } from "../../Utilities/I18n";
import { prefixAttr } from "../../Utilities/IDUtils";
import { pipe } from "../../Utilities/pipe";
import { AvatarChange } from "../Universal/AvatarChange";
import { AvatarWrapper } from "../Universal/AvatarWrapper";
import { BorderButton } from "../Universal/BorderButton";
import { Slidein } from "../Universal/Slidein";
import { TextField } from "../Universal/TextField";

export interface PetEditorProps {
  attributes: WikiModel["attributes"]
  petInEditor: Maybe<Record<EditPet>>
  l10n: L10nRecord
  isEditPetAvatarOpen: boolean
  isInCreation: Maybe<boolean>

  closePetEditor (): void
  addPet (): void
  savePet (): void
  openEditPetAvatar (): void
  closeEditPetAvatar (): void

  setAvatar (path: string): void
  deleteAvatar (): void
  setName (name: string): void
  setSize (size: string): void
  setType (type: string): void
  setSpentAp (spentAp: string): void
  setTotalAp (totalAp: string): void
  setCourage (courage: string): void
  setSagacity (sagacity: string): void
  setIntuition (intuition: string): void
  setCharisma (charisma: string): void
  setDexterity (dexterity: string): void
  setAgility (agility: string): void
  setConstitution (constitution: string): void
  setStrength (strength: string): void
  setLp (lp: string): void
  setAe (ae: string): void
  setSpi (spi: string): void
  setTou (tou: string): void
  setPro (pro: string): void
  setIni (ini: string): void
  setMov (mov: string): void
  setAttack (attack: string): void
  setAt (at: string): void
  setPa (pa: string): void
  setDp (dp: string): void
  setReach (reach: string): void
  setActions (actions: string): void
  setSkills (skills: string): void
  setAbilities (abilities: string): void
  setNotes (notes: string): void
}

const EPA = EditPet.A

export function PetEditor (props: PetEditorProps) {
  const { attributes, petInEditor: mpet_in_editor, l10n, isInCreation } = props

  if (isJust (mpet_in_editor)) {
    const pet = fromJust (mpet_in_editor)

    return (
      <Slidein isOpen close={props.closePetEditor}>
        <div className="pet-edit">
          <div className="left">
            <AvatarWrapper src={EPA.avatar (pet)} onClick={props.openEditPetAvatar} />
            <BorderButton
              className="delete-avatar"
              label={translate (l10n) ("deleteavatar")}
              onClick={props .deleteAvatar}
              disabled={isNothing (EPA.avatar (pet))}
              />
          </div>
          <div className="right">
            <div className="row">
              <TextField
                label={translate (l10n) ("name")}
                value={EPA.name (pet)}
                onChangeString={props.setName}
                />
              <TextField
                label={translate (l10n) ("sizecategory")}
                value={EPA.size (pet)}
                onChangeString={props.setSize}
                />
              <TextField
                label={translate (l10n) ("type")}
                value={EPA.type (pet)}
                onChangeString={props.setType}
                />
              <TextField
                label={translate (l10n) ("apspent.novar")}
                value={EPA.spentAp (pet)}
                onChangeString={props.setSpentAp}
                />
              <TextField
                label={translate (l10n) ("totalap.novar")}
                value={EPA.totalAp (pet)}
                onChangeString={props.setTotalAp}
                />
            </div>
            <div className="row">
              <TextField
                label={getAttrShort (attributes) (prefixAttr (1))}
                value={EPA.cou (pet)}
                onChangeString={props.setCourage}
                />
              <TextField
                label={getAttrShort (attributes) (prefixAttr (2))}
                value={EPA.sgc (pet)}
                onChangeString={props.setSagacity}
                />
              <TextField
                label={getAttrShort (attributes) (prefixAttr (3))}
                value={EPA.int (pet)}
                onChangeString={props.setIntuition}
                />
              <TextField
                label={getAttrShort (attributes) (prefixAttr (4))}
                value={EPA.cha (pet)}
                onChangeString={props.setCharisma}
                />
              <TextField
                label={getAttrShort (attributes) (prefixAttr (5))}
                value={EPA.dex (pet)}
                onChangeString={props.setDexterity}
                />
              <TextField
                label={getAttrShort (attributes) (prefixAttr (6))}
                value={EPA.agi (pet)}
                onChangeString={props.setAgility}
                />
              <TextField
                label={getAttrShort (attributes) (prefixAttr (7))}
                value={EPA.con (pet)}
                onChangeString={props.setConstitution}
                />
              <TextField
                label={getAttrShort (attributes) (prefixAttr (8))}
                value={EPA.str (pet)}
                onChangeString={props.setStrength}
                />
            </div>
            <div className="row">
              <TextField
                label={translate (l10n) ("lifepoints.short")}
                value={EPA.lp (pet)}
                onChangeString={props.setLp}
                />
              <TextField
                label={translate (l10n) ("arcaneenergy.short")}
                value={EPA.ae (pet)}
                onChangeString={props.setAe}
                />
              <TextField
                label={translate (l10n) ("spirit.short")}
                value={EPA.spi (pet)}
                onChangeString={props.setSpi}
                />
              <TextField
                label={translate (l10n) ("toughness.short")}
                value={EPA.tou (pet)}
                onChangeString={props.setTou}
                />
              <TextField
                label={translate (l10n) ("protection.short")}
                value={EPA.pro (pet)}
                onChangeString={props.setPro}
                />
              <TextField
                label={translate (l10n) ("initiative.short")}
                value={EPA.ini (pet)}
                onChangeString={props.setIni}
                />
              <TextField
                label={translate (l10n) ("movement.short")}
                value={EPA.mov (pet)}
                onChangeString={props.setMov}
                />
            </div>
            <div className="row">
              <TextField
                label={translate (l10n) ("attack")}
                value={EPA.attack (pet)}
                onChangeString={props.setAttack}
                />
              <TextField
                label={translate (l10n) ("attack.short")}
                value={EPA.at (pet)}
                onChangeString={props.setAt}
                />
              <TextField
                label={translate (l10n) ("parry.short")}
                value={EPA.pa (pet)}
                onChangeString={props.setPa}
                />
              <TextField
                label={translate (l10n) ("damagepoints.short")}
                value={EPA.dp (pet)}
                onChangeString={props.setDp}
                />
              <TextField
                label={translate (l10n) ("reach")}
                value={EPA.reach (pet)}
                onChangeString={props.setReach}
                />
            </div>
            <div className="row">
              <TextField
                label={translate (l10n) ("actions")}
                value={EPA.actions (pet)}
                onChangeString={props.setActions}
                />
              <TextField
                label={translate (l10n) ("skills")}
                value={EPA.talents (pet)}
                onChangeString={props.setSkills}
                />
              <TextField
                label={translate (l10n) ("specialabilities")}
                value={EPA.skills (pet)}
                onChangeString={props.setAbilities}
                />
            </div>
            <div className="row">
              <TextField
                label={translate (l10n) ("notes")}
                value={EPA.notes (pet)}
                onChangeString={props.setNotes}
                />
            </div>
            {Maybe.elem (true) (isInCreation)
              ? (
                <BorderButton
                  label={translate (l10n) ("add")}
                  onClick={props.addPet}
                  />
              )
              : (
                <BorderButton
                  label={translate (l10n) ("save")}
                  onClick={props.savePet}
                  />
              )}
          </div>
        </div>
        <AvatarChange
          l10n={l10n}
          setPath={props.setAvatar}
          close={props.closeEditPetAvatar}
          isOpen={props.isEditPetAvatarOpen}
          />
      </Slidein>
    )
  }

  return null
}

const getAttrShort =
  (attrs: WikiModel["attributes"]) =>
    pipe (lookupF (attrs), fmap (Attribute.A.short))
