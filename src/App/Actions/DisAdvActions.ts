import { fmap, fmapF } from "../../Data/Functor";
import { over, set } from "../../Data/Lens";
import { List, subscriptF, uncons } from "../../Data/List";
import { altF_, bind, bindF, elem, ensure, fromJust, isJust, join, Just, liftM2, Maybe, Nothing } from "../../Data/Maybe";
import { negate, subtract } from "../../Data/Num";
import { lookup } from "../../Data/OrderedMap";
import { Record } from "../../Data/Record";
import { fst, Pair, PairP1_, snd } from "../../Data/Tuple";
import { ActionTypes } from "../Constants/ActionTypes";
import { ActivatableActivationEntryType } from "../Models/Actions/ActivatableActivationEntryType";
import { ActivatableActivationOptions } from "../Models/Actions/ActivatableActivationOptions";
import { ActivatableDeactivationEntryType } from "../Models/Actions/ActivatableDeactivationEntryType";
import { ActivatableDeactivationOptions, ActivatableDeactivationOptionsL } from "../Models/Actions/ActivatableDeactivationOptions";
import { ActivatableDependent } from "../Models/ActiveEntries/ActivatableDependent";
import { ActiveObject } from "../Models/ActiveEntries/ActiveObject";
import { ActiveObjectWithIdL, toActiveObjectWithId } from "../Models/ActiveEntries/ActiveObjectWithId";
import { HeroModel, HeroModelRecord } from "../Models/Hero/HeroModel";
import { ActivatableNameCost, ActivatableNameCostSafeCost } from "../Models/View/ActivatableNameCost";
import { Advantage, isAdvantage } from "../Models/Wiki/Advantage";
import { Disadvantage, isDisadvantage } from "../Models/Wiki/Disadvantage";
import { L10nRecord } from "../Models/Wiki/L10n";
import { Race } from "../Models/Wiki/Race";
import { RaceVariant } from "../Models/Wiki/RaceVariant";
import { getAPObjectMap } from "../Selectors/adventurePointsSelectors";
import { getIsInCharacterCreation } from "../Selectors/phaseSelectors";
import { getAutomaticAdvantages, getCurrentRaceVariant, getRace } from "../Selectors/rcpSelectors";
import { getCurrentHeroPresent, getWiki } from "../Selectors/stateSelectors";
import { getNameCost } from "../Utilities/Activatable/activatableActiveUtils";
import { isBlessedOrMagical } from "../Utilities/Activatable/checkActivatableUtils";
import { convertPerTierCostToFinalCost } from "../Utilities/AdventurePoints/activatableCostUtils";
import { getDisAdvantagesSubtypeMax, getMissingAPForDisAdvantage, MissingAPForDisAdvantage } from "../Utilities/AdventurePoints/adventurePointsUtils";
import { translate, translateP } from "../Utilities/I18n";
import { pipe, pipe_ } from "../Utilities/pipe";
import { misNumberM } from "../Utilities/typeCheckUtils";
import { getWikiEntry } from "../Utilities/WikiUtils";
import { ReduxAction, ReduxDispatch } from "./Actions";
import { addAlert } from "./AlertActions";

/**
 * Advantages and disadvantages might not only be added or removed due to not
 * enough AP but also due to limitations regarding AP spent on advantages,
 * disadvantages or subtypes thereof (blessed, magical). This function ensures
 * that the appropiate error message is displayed if an entry cannot be added or
 * removed.
 *
 * If the addition or removal is valid, the passed `successFn` will be called.
 */
const handleMissingAPForDisAdvantage =
  (l10n: L10nRecord) =>
  (success: () => void) =>
  (hero: HeroModelRecord) =>
  (missing_ap: Record<MissingAPForDisAdvantage>) =>
  (is_blessed_or_magical: Pair<boolean, boolean>) =>
  (is_disadvantage: boolean) =>
  (dispatch: ReduxDispatch) => {
    const totalMissing = MissingAPForDisAdvantage.AL.totalMissing (missing_ap)
    const mainMissing = MissingAPForDisAdvantage.AL.mainMissing (missing_ap)
    const subMissing = MissingAPForDisAdvantage.AL.subMissing (missing_ap)

    if (isJust (totalMissing)) {
      dispatch (addAlert ({
        title: translate (l10n) ("notenoughap"),
        message: translateP (l10n) ("notenoughap.text") (List (fromJust (totalMissing))),
      }))
    }
    else if (isJust (mainMissing)) {
      const type = is_disadvantage
        ? translate (l10n) ("disadvantages")
        : translate (l10n) ("advantages")

      dispatch (addAlert ({
        title: translateP (l10n) ("reachedlimit") (List (type)),
        message: translateP (l10n)
                            ("reachedaplimit")
                            (List<string | number> (fromJust (mainMissing), 80, type)),
      }))
    }
    else if (isJust (subMissing)) {
      const ap = getDisAdvantagesSubtypeMax (snd (is_blessed_or_magical)) (hero)

      const type = is_disadvantage
        ? fst (is_blessed_or_magical)
          ? translate (l10n) ("blesseddisadvantages")
          : translate (l10n) ("magicaldisadvantages")
        : fst (is_blessed_or_magical)
          ? translate (l10n) ("blessedadvantages")
          : translate (l10n) ("magicaladvantages")

      dispatch (addAlert ({
        title: translateP (l10n) ("reachedlimit") (List (type)),
        message: translateP (l10n)
                            ("reachedaplimit")
                            (List<string | number> (fromJust (subMissing), ap, type)),
      }))
    }
    else {
      success ()
    }
  }

export interface ActivateDisAdvAction {
  type: ActionTypes.ACTIVATE_DISADV
  payload: Pair<Record<ActivatableActivationOptions>, Record<ActivatableActivationEntryType>>
}

/**
 * Add an advantage or disadvantage with the provided activation properties
 * (`args`).
 */
export const addDisAdvantage =
  (l10n: L10nRecord) =>
  (args: Record<ActivatableActivationOptions>): ReduxAction =>
  (dispatch, getState) => {
    const state = getState ()

    const mhero = getCurrentHeroPresent (state)

    if (isJust (mhero)) {
      const hero = fromJust (mhero)

      const current_id = ActivatableActivationOptions.AL.id (args)
      const current_cost = ActivatableActivationOptions.AL.cost (args)

      const mwiki_entry =
        bind (getWikiEntry (getWiki (state)) (current_id))
             (ensure ((x): x is Record<Advantage> | Record<Disadvantage> =>
                       isAdvantage (x) || isDisadvantage (x)))

      const mhero_entry =
        bind (mwiki_entry)
             (x => lookup (current_id)
                          (isAdvantage (x)
                            ? HeroModel.AL.advantages (hero)
                            : HeroModel.AL.disadvantages (hero)))

      if (isJust (mwiki_entry)) {
        const wiki_entry = fromJust (mwiki_entry)

        const is_disadvantage = isDisadvantage (wiki_entry)

        const entryType = isBlessedOrMagical (wiki_entry)

        const mmissingAPForDisAdvantage =
          fmapF (join (getAPObjectMap (HeroModel.A.id (hero)) (state, { l10n, hero })))
                (ap => getMissingAPForDisAdvantage (getIsInCharacterCreation (state))
                                                   (entryType)
                                                   (is_disadvantage)
                                                   (hero)
                                                   (ap)
                                                   (current_cost))

        const successFn = () => {
          const color: Maybe<Pair<number, number>> =
            current_id === "DISADV_45"
            && elem<string | number> (1) (ActivatableActivationOptions.AL.selectOptionId1 (args))
              ? Just (Pair (19, 24)) // (eyeColor, hairColor)
              : Nothing

          dispatch<ActivateDisAdvAction> ({
            type: ActionTypes.ACTIVATE_DISADV,
            payload:
              Pair (
                args,
                ActivatableActivationEntryType ({
                  eyeColor: fmapF (color) (fst),
                  hairColor: fmapF (color) (snd),
                  isBlessed: fst (entryType),
                  isDisadvantage: is_disadvantage,
                  isMagical: snd (entryType),
                  heroEntry: mhero_entry,
                  wikiEntry: wiki_entry,
                })
              ),
          })
        }

        if (isJust (mmissingAPForDisAdvantage)) {
          handleMissingAPForDisAdvantage (l10n)
                                         (successFn)
                                         (hero)
                                         (fromJust (mmissingAPForDisAdvantage))
                                         (entryType)
                                         (is_disadvantage)
                                         (dispatch)
        }
      }
    }
  }

export interface DeactivateDisAdvAction {
  type: ActionTypes.DEACTIVATE_DISADV
  payload: Pair<Record<ActivatableDeactivationOptions>, Record<ActivatableDeactivationEntryType>>
}

/**
 * Remove an advantage or disadvantage with the provided activation properties
 * (`args`).
 */
export const removeDisAdvantage =
  (l10n: L10nRecord) =>
  (args: Record<ActivatableDeactivationOptions>): ReduxAction =>
  (dispatch, getState) => {
    const state = getState ()

    const mhero = getCurrentHeroPresent (state)

    if (isJust (mhero)) {
      const hero = fromJust (mhero)

      const current_id = ActivatableDeactivationOptions.AL.id (args)
      const current_index = ActivatableDeactivationOptions.AL.index (args)
      const current_cost = ActivatableDeactivationOptions.AL.cost (args)

      const negativeCost = current_cost * -1 // the entry should be removed

      const mwiki_entry =
        bind (getWikiEntry (getWiki (state)) (current_id))
             (ensure ((x): x is Record<Advantage> | Record<Disadvantage> =>
                       isAdvantage (x) || isDisadvantage (x)))

      const mhero_entry =
        bind (mwiki_entry)
             (x => lookup (current_id)
                          (isAdvantage (x)
                            ? HeroModel.AL.advantages (hero)
                            : HeroModel.AL.disadvantages (hero)))

      if (isJust (mwiki_entry) && isJust (mhero_entry)) {
        const wiki_entry = fromJust (mwiki_entry)
        const hero_entry = fromJust (mhero_entry)

        const is_disadvantage = isDisadvantage (wiki_entry)

        const entryType = isBlessedOrMagical (wiki_entry)

        const mmissingAPForDisAdvantage =
          fmapF (join (getAPObjectMap (HeroModel.A.id (hero)) (state, { l10n, hero })))
                (ap => getMissingAPForDisAdvantage (getIsInCharacterCreation (state))
                                                   (entryType)
                                                   (is_disadvantage)
                                                   (hero)
                                                   (ap)
                                                   (negativeCost))

        const successFn = () => {
          const color: Maybe<Pair<number, number>> =
            current_id === "DISADV_45"
            && elem (1)
                    (pipe_ (
                      hero_entry,
                      ActivatableDependent.A.active,
                      subscriptF (current_index),
                      bindF (ActiveObject.A.sid),
                      misNumberM
                    ))
              ? bind (getRace (state, { hero }))
                     (race => {
                       const mrace_var = getCurrentRaceVariant (state)

                       const p = Pair (
                         pipe (
                                Race.AL.eyeColors,
                                altF_ (() => bind (mrace_var) (RaceVariant.AL.eyeColors)),
                                bindF (uncons),
                                fmap (fst)
                              )
                              (race),
                         pipe (
                                Race.AL.hairColors,
                                altF_ (() => bind (mrace_var) (RaceVariant.AL.hairColors)),
                                bindF (uncons),
                                fmap (fst)
                              )
                              (race)
                       )

                       return liftM2 (Pair as PairP1_) <number, number> (fst (p)) (snd (p))
                     })
              : Nothing

          dispatch<DeactivateDisAdvAction> ({
            type: ActionTypes.DEACTIVATE_DISADV,
            payload:
              Pair (
                over (ActivatableDeactivationOptionsL.cost) (negate) (args),
                ActivatableDeactivationEntryType ({
                  eyeColor: fmapF (color) (fst),
                  hairColor: fmapF (color) (snd),
                  isBlessed: fst (entryType),
                  isDisadvantage: is_disadvantage,
                  isMagical: snd (entryType),
                  heroEntry: hero_entry,
                  wikiEntry: wiki_entry,
                })
              ),
          })
        }

        if (isJust (mmissingAPForDisAdvantage)) {
          handleMissingAPForDisAdvantage (l10n)
                                         (successFn)
                                         (hero)
                                         (fromJust (mmissingAPForDisAdvantage))
                                         (entryType)
                                         (is_disadvantage)
                                         (dispatch)
        }
      }
    }
  }

export interface SetDisAdvLevelAction {
  type: ActionTypes.SET_DISADV_TIER
  payload: Pair<
    { id: string; index: number; tier: number },
    Record<ActivatableDeactivationEntryType>
  >
}

/**
 * Change the current level of an advantage or disadvantage.
 */
export const setDisAdvantageLevel =
  (l10n: L10nRecord) =>
  (current_id: string) =>
  (current_index: number) =>
  (next_level: number): ReduxAction =>
  (dispatch, getState) => {
    const state = getState ()

    const mhero = getCurrentHeroPresent (state)

    if (isJust (mhero)) {
      const hero = fromJust (mhero)

      const mwiki_entry =
        bind (getWikiEntry (getWiki (state)) (current_id))
             (ensure ((x): x is Record<Advantage> | Record<Disadvantage> =>
                       isAdvantage (x) || isDisadvantage (x)))

      const mhero_entry =
        bind (mwiki_entry)
             (x => lookup (current_id)
                          (isAdvantage (x)
                            ? HeroModel.AL.advantages (hero)
                            : HeroModel.AL.disadvantages (hero)))

      const mactive_entry =
        pipe (
               bindF (pipe (
                             ActivatableDependent.A.active,
                             subscriptF (current_index)
                           )),
               fmap (toActiveObjectWithId (current_index) (current_id))
             )
             (mhero_entry)

      if (isJust (mwiki_entry) && isJust (mhero_entry) && isJust (mactive_entry)) {
        const wiki_entry = fromJust (mwiki_entry)
        const active_entry = fromJust (mactive_entry)

        const wiki = getWiki (state)

        const getCostBorder =
          (isEntryToAdd: boolean) =>
            pipe (
              getNameCost (isEntryToAdd)
                          (getAutomaticAdvantages (state, { hero }))
                          (l10n)
                          (wiki)
                          (hero),
              fmap (pipe (
                convertPerTierCostToFinalCost (true) (l10n),
                ActivatableNameCost.A.finalCost as
                  (x: Record<ActivatableNameCostSafeCost>) => number
              ))
            )

        const previousCost =
          getCostBorder (false) (active_entry)

        const nextCost =
          getCostBorder (true) (set (ActiveObjectWithIdL.tier)
                                    (Just (next_level))
                                    (active_entry))

        const mdiff_cost = liftM2 (subtract) (nextCost) (previousCost)

        if (isJust (mdiff_cost)) {
          const diff_cost = fromJust (mdiff_cost)

          const is_disadvantage = isDisadvantage (wiki_entry)

          const entryType = isBlessedOrMagical (wiki_entry)

          const mmissingAPForDisAdvantage =
            fmapF (join (getAPObjectMap (HeroModel.A.id (hero)) (state, { l10n, hero })))
                  (ap => getMissingAPForDisAdvantage (getIsInCharacterCreation (state))
                                                     (entryType)
                                                     (is_disadvantage)
                                                     (hero)
                                                     (ap)
                                                     (diff_cost))

          const successFn = () => {
            dispatch<SetDisAdvLevelAction> ({
              type: ActionTypes.SET_DISADV_TIER,
              payload:
                Pair (
                  {
                    id: current_id,
                    tier: next_level,
                    index: current_index,
                  },
                  ActivatableDeactivationEntryType ({
                    eyeColor: Nothing,
                    hairColor: Nothing,
                    isBlessed: fst (entryType),
                    isDisadvantage: is_disadvantage,
                    isMagical: snd (entryType),
                    heroEntry: fromJust (mhero_entry),
                    wikiEntry: wiki_entry,
                  })
                ),
            })
          }

          if (isJust (mmissingAPForDisAdvantage)) {
            handleMissingAPForDisAdvantage (l10n)
                                           (successFn)
                                           (hero)
                                           (fromJust (mmissingAPForDisAdvantage))
                                           (entryType)
                                           (is_disadvantage)
                                           (dispatch)
          }
        }
      }
    }
  }

export interface SwitchDisAdvRatingVisibilityAction {
  type: ActionTypes.SWITCH_DISADV_RATING_VISIBILITY
}

export const switchRatingVisibility = (): SwitchDisAdvRatingVisibilityAction => ({
  type: ActionTypes.SWITCH_DISADV_RATING_VISIBILITY,
})

export interface SetActiveAdvantagesFilterTextAction {
  type: ActionTypes.SET_ADVANTAGES_FILTER_TEXT
  payload: {
    filterText: string;
  }
}

export const setActiveAdvantagesFilterText =
  (filterText: string): SetActiveAdvantagesFilterTextAction => ({
    type: ActionTypes.SET_ADVANTAGES_FILTER_TEXT,
    payload: {
      filterText,
    },
  })

export interface SetInactiveAdvantagesFilterTextAction {
  type: ActionTypes.SET_INACTIVE_ADVANTAGES_FILTER_TEXT
  payload: {
    filterText: string;
  }
}

export const setInactiveAdvantagesFilterText =
  (filterText: string): SetInactiveAdvantagesFilterTextAction => ({
    type: ActionTypes.SET_INACTIVE_ADVANTAGES_FILTER_TEXT,
    payload: {
      filterText,
    },
  })

export interface SetActiveDisadvantagesFilterTextAction {
  type: ActionTypes.SET_DISADVANTAGES_FILTER_TEXT
  payload: {
    filterText: string;
  }
}

export const setActiveDisadvantagesFilterText =
  (filterText: string): SetActiveDisadvantagesFilterTextAction => ({
    type: ActionTypes.SET_DISADVANTAGES_FILTER_TEXT,
    payload: {
      filterText,
    },
  })

export interface SetInactiveDisadvantagesFilterTextAction {
  type: ActionTypes.SET_INACTIVE_DISADVANTAGES_FILTER_TEXT
  payload: {
    filterText: string;
  }
}

export const setInactiveDisadvantagesFilterText =
  (filterText: string): SetInactiveDisadvantagesFilterTextAction => ({
    type: ActionTypes.SET_INACTIVE_DISADVANTAGES_FILTER_TEXT,
    payload: {
      filterText,
    },
  })
