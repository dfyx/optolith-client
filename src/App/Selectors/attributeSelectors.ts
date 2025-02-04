import { equals } from "../../Data/Eq";
import { blackbirdF } from "../../Data/Function";
import { fmap, fmapF, mapReplace } from "../../Data/Functor";
import { consF, elem, filter, find, flength, head, List, map, maximum, NonEmptyList, notNull } from "../../Data/List";
import { any, bind, bindF, ensure, fromJust, fromMaybe, isJust, isNothing, join, Just, liftM2, mapMaybe, maybe, Maybe, Nothing, or } from "../../Data/Maybe";
import { add, gte, lt, max, multiply, subtractBy } from "../../Data/Num";
import { elems, foldr, lookup, lookupF, OrderedMap } from "../../Data/OrderedMap";
import { Record } from "../../Data/Record";
import { fst, snd, Tuple } from "../../Data/Tuple";
import { uncurryN, uncurryN3 } from "../../Data/Tuple/Curry";
import { sel1, sel2, sel3 } from "../../Data/Tuple/Select";
import { IdPrefixes } from "../Constants/IdPrefixes";
import { ActivatableDependent } from "../Models/ActiveEntries/ActivatableDependent";
import { AttributeDependent, createPlainAttributeDependent } from "../Models/ActiveEntries/AttributeDependent";
import { Energies } from "../Models/Hero/Energies";
import { HeroModel, HeroModelRecord } from "../Models/Hero/HeroModel";
import { AttributeCombined, AttributeCombinedA_ } from "../Models/View/AttributeCombined";
import { AttributeWithRequirements } from "../Models/View/AttributeWithRequirements";
import { Attribute } from "../Models/Wiki/Attribute";
import { ExperienceLevel } from "../Models/Wiki/ExperienceLevel";
import { Race } from "../Models/Wiki/Race";
import { WikiModel, WikiModelRecord } from "../Models/Wiki/WikiModel";
import { createMaybeSelector } from "../Utilities/createMaybeSelector";
import { flattenDependencies } from "../Utilities/Dependencies/flattenDependencies";
import { getNumericBlessedTraditionIdByInstanceId, getNumericMagicalTraditionIdByInstanceId, prefixAttr, prefixId } from "../Utilities/IDUtils";
import { pipe, pipe_ } from "../Utilities/pipe";
import { getCurrentEl, getStartEl } from "./elSelectors";
import { getBlessedTraditionFromState } from "./liturgicalChantsSelectors";
import { getRace } from "./rcpSelectors";
import { getMagicalTraditionsFromHero } from "./spellsSelectors";
import { getAttributes, getAttributeValueLimit, getCurrentAttributeAdjustmentId, getCurrentHeroPresent, getHeroProp, getPhase, getWiki, getWikiAttributes } from "./stateSelectors";

const HA = HeroModel.A
const EA = Energies.A
const ACA = AttributeCombined.A
const ACA_ = AttributeCombinedA_
const AA = Attribute.A
const ADA = AttributeDependent.A
const AWRA = AttributeWithRequirements.A

export const getAttributeSum = createMaybeSelector (
  getAttributes,
  getWikiAttributes,
  uncurryN (hero_attrs => foldr (pipe (
                                  AA.id,
                                  lookupF (hero_attrs),
                                  maybe (add (8))
                                        (pipe (ADA.value, add))
                                ))
                                (0))
)

/**
 * Returns the modifier if the attribute specified by `id` is a member of the
 * race `race`
 */
const getModIfSelectedAdjustment =
  (id: string) =>
  (race: Record<Race>) =>
    pipe_ (
      race,
      Race.A.attributeAdjustmentsSelection,
      snd,
      ensure (elem (id)),
      mapReplace (fst (Race.A.attributeAdjustmentsSelection (race))),
      Maybe.sum
    )

const getModIfStaticAdjustment =
  (id: string) =>
    pipe (
      Race.A.attributeAdjustments,
      List.lookup (id),
      Maybe.sum
    )

const getAttributeMaximum =
  (id: string) =>
  (mrace: Maybe<Record<Race>>) =>
  (adjustmentId: string) =>
  (startEl: Maybe<Record<ExperienceLevel>>) =>
  (currentEl: Maybe<Record<ExperienceLevel>>) =>
  (phase: Maybe<number>) =>
  (attributeValueLimit: Maybe<boolean>): Maybe<number> => {
    if (any (lt (3)) (phase)) {
      if (isJust (mrace)) {
        const race = fromJust (mrace)
        const selectedAdjustment = adjustmentId === id ? getModIfSelectedAdjustment (id) (race) : 0
        const staticAdjustment = getModIfStaticAdjustment (id) (race)

        return fmapF (startEl)
                     (pipe (
                       ExperienceLevel.A.maxAttributeValue,
                       add (selectedAdjustment + staticAdjustment)
                     ))
      }

      return Just (0)
    }

    if (or (attributeValueLimit)) {
      return fmapF (currentEl) (pipe (ExperienceLevel.A.maxAttributeValue, add (2)))
    }

    return Nothing
  }

const getAttributeMinimum =
  (wiki: WikiModelRecord) =>
  (hero: HeroModelRecord) =>
  /**
   * `(lp, ae, kp)`
   */
  (added: Tuple<[number, number, number]>) =>
  (mblessed_primary_attr: Maybe<Record<AttributeCombined>>) =>
  (mhighest_magical_primary_attr: Maybe<Record<AttributeCombined>>) =>
  (hero_entry: Record<AttributeDependent>): number =>
    maximum (List<number> (
              ...flattenDependencies (wiki) (hero) (ADA.dependencies (hero_entry)),
              ...(ADA.id (hero_entry) === prefixAttr (8) ? List (sel1 (added)) : List<number> ()),
              ...(Maybe.elem (ADA.id (hero_entry)) (fmap (ACA_.id) (mhighest_magical_primary_attr))
                ? List (sel2 (added))
                : List<number> ()),
              ...(Maybe.elem (ADA.id (hero_entry)) (fmap (ACA_.id) (mblessed_primary_attr))
                ? List (sel3 (added))
                : List<number> ()),
              8
            ))

const getAddedEnergies = createMaybeSelector (
  getHeroProp,
  hero => Tuple (
    pipe_ (hero, HA.energies, EA.addedLifePoints),
    pipe_ (hero, HA.energies, EA.addedArcaneEnergyPoints),
    pipe_ (hero, HA.energies, EA.addedKarmaPoints)
  )
)

/**
 * Returns a `List` of attributes containing the current state and full wiki
 * info.
 */
export const getAttributesForSheet = createMaybeSelector (
  getAttributes,
  getWikiAttributes,
  uncurryN (hero_entries => pipe (
                              elems,
                              map (wiki_entry => {
                                const id = AA.id (wiki_entry)

                                return AttributeCombined ({
                                  stateEntry: fromMaybe (createPlainAttributeDependent (id))
                                                        (lookup (id) (hero_entries)),
                                  wikiEntry: wiki_entry,
                                })
                              })
                            ))
)

/**
 * Returns the maximum attribute value of the list of given attribute ids.
 */
export const getMaxAttributeValueByID =
  (attributes: HeroModel["attributes"]) =>
    pipe (
      mapMaybe (pipe (lookupF (attributes), fmap (ADA.value))),
      consF (8),
      maximum
    )

const getAttributeCombined =
  (wiki_attributes: OrderedMap<string, Record<Attribute>>) =>
  (hero_attributes: OrderedMap<string, Record<AttributeDependent>>) =>
  (id: string) =>
    fmapF (lookup (id) (wiki_attributes))
          (wiki_entry => AttributeCombined ({
                           stateEntry: fromMaybe (createPlainAttributeDependent (id))
                                                 (lookup (id) (hero_attributes)),
                           wikiEntry: wiki_entry,
                         }))

const getPrimaryMagicalAttributeByTrad =
  (wiki_attributes: WikiModel["attributes"]) =>
  (hero_attributes: HeroModel["attributes"]) =>
  (tradition: Record<ActivatableDependent>): Maybe<Record<AttributeCombined>> =>
    pipe_ (
      tradition,
      ActivatableDependent.A.id,
      getNumericMagicalTraditionIdByInstanceId,
      bindF (numericId => {
        switch (numericId) {
          case 1:
          case 4:
          case 10:
          case 13:
            return getAttributeCombined (wiki_attributes)
                                        (hero_attributes)
                                        (prefixId (IdPrefixes.ATTRIBUTES) (2))

          case 3:
          case 14:
          case 15:
          case 16:
            return getAttributeCombined (wiki_attributes)
                                        (hero_attributes)
                                        (prefixId (IdPrefixes.ATTRIBUTES) (3))

          case 2:
          case 5:
          case 6:
          case 7:
          case 12:
          case 17:
            return getAttributeCombined (wiki_attributes)
                                        (hero_attributes)
                                        (prefixId (IdPrefixes.ATTRIBUTES) (4))

          default:
            return Nothing
        }
      })
    )

export const getPrimaryMagicalAttributes = createMaybeSelector (
  getWikiAttributes,
  getAttributes,
  getMagicalTraditionsFromHero,
  uncurryN3 (wiki_attributes =>
             hero_attributes =>
               mapMaybe (getPrimaryMagicalAttributeByTrad (wiki_attributes) (hero_attributes)))
)

export const getHighestPrimaryMagicalAttributeValue = createMaybeSelector (
  getPrimaryMagicalAttributes,
  pipe (ensure (notNull), fmap (List.foldr (pipe (ACA_.value, max)) (0)))
)

export const getHighestPrimaryMagicalAttributes = createMaybeSelector (
  getPrimaryMagicalAttributes,
  getHighestPrimaryMagicalAttributeValue,
  uncurryN (attrs => fmap (max_value => filter (pipe (ACA_.value, equals (max_value))) (attrs)))
)

type AttrCs = List<Record<AttributeCombined>>
type NonEmotyAttrCs = NonEmptyList<Record<AttributeCombined>>

export const getHighestPrimaryMagicalAttribute = createMaybeSelector (
  getHighestPrimaryMagicalAttributes,
  pipe (
    bindF (ensure (pipe (flength, equals (1)) as (xs: AttrCs) => xs is NonEmotyAttrCs)),
    fmap (head)
  )
)

export const getPrimaryMagicalAttributeForSheet = createMaybeSelector (
  getPrimaryMagicalAttributes,
  map (ACA_.short)
)

const getPrimaryBlessedAttributeByTrad =
  (wiki_attributes: WikiModel["attributes"]) =>
  (hero_attributes: HeroModel["attributes"]) =>
  (tradition: Record<ActivatableDependent>): Maybe<Record<AttributeCombined>> =>
    pipe_ (
      tradition,
      ActivatableDependent.A.id,
      getNumericBlessedTraditionIdByInstanceId,
      bindF (numericId => {
        switch (numericId) {
          case 2:
          case 3:
          case 9:
          case 13:
          case 16:
          case 18:
            return getAttributeCombined (wiki_attributes)
                                        (hero_attributes)
                                        (prefixId (IdPrefixes.ATTRIBUTES) (1))

          case 1:
          case 4:
          case 8:
          case 17:
            return getAttributeCombined (wiki_attributes)
                                        (hero_attributes)
                                        (prefixId (IdPrefixes.ATTRIBUTES) (2))

          case 5:
          case 6:
          case 11:
          case 14:
            return getAttributeCombined (wiki_attributes)
                                        (hero_attributes)
                                        (prefixId (IdPrefixes.ATTRIBUTES) (3))

          case 7:
          case 10:
          case 12:
          case 15:
            return getAttributeCombined (wiki_attributes)
                                        (hero_attributes)
                                        (prefixId (IdPrefixes.ATTRIBUTES) (4))

          default:
            return Nothing
        }
      })
    )

export const getPrimaryBlessedAttribute = createMaybeSelector (
  getBlessedTraditionFromState,
  getAttributes,
  getWikiAttributes,
  (mtradition, mhero_attributes, wiki_attributes) =>
    bind (mtradition)
         (getPrimaryBlessedAttributeByTrad (wiki_attributes)
                                           (mhero_attributes))
)

export const getPrimaryBlessedAttributeForSheet = createMaybeSelector (
  getPrimaryBlessedAttribute,
  fmap (pipe (ACA.wikiEntry, AA.short))
)

/**
 * Returns a `List` of attributes including state, full wiki infos and a
 * minimum and optional maximum value.
 */
export const getAttributesForView = createMaybeSelector (
  getCurrentHeroPresent,
  getStartEl,
  getCurrentEl,
  getPhase,
  getAttributeValueLimit,
  getWiki,
  getRace,
  getAddedEnergies,
  getPrimaryBlessedAttribute,
  getHighestPrimaryMagicalAttribute,
  (
    mhero,
    startEl,
    currentEl,
    mphase,
    attributeValueLimit,
    wiki,
    mrace,
    added,
    mblessed_primary_attr,
    mhighest_magical_primary_attr
  ) =>
    fmapF (mhero)
          (hero => foldr ((wiki_entry: Record<Attribute>) => {
                           const current_id = AA.id (wiki_entry)

                           const hero_entry = fromMaybe (createPlainAttributeDependent (current_id))
                                                        (pipe_ (
                                                          hero,
                                                          HeroModel.A.attributes,
                                                          lookup (current_id)
                                                        ))

                           const max_value =
                             getAttributeMaximum (current_id)
                                                 (mrace)
                                                 (HeroModel.A.attributeAdjustmentSelected (hero))
                                                 (startEl)
                                                 (currentEl)
                                                 (mphase)
                                                 (attributeValueLimit)

                           const min_value =
                             getAttributeMinimum (wiki)
                                                 (hero)
                                                 (added)
                                                 (mblessed_primary_attr)
                                                 (mhighest_magical_primary_attr)
                                                 (hero_entry)

                           return consF (AttributeWithRequirements ({
                                          max: max_value,
                                          min: min_value,
                                          stateEntry: hero_entry,
                                          wikiEntry: wiki_entry,
                                        }))
                         })
                         (List.empty)
                         (WikiModel.A.attributes (wiki)))
)

export const getCarryingCapacity = createMaybeSelector (
  getAttributes,
  pipe (lookup (prefixAttr (8)), fmap (pipe (ADA.value, multiply (2))))
)

export const getAdjustmentValue = createMaybeSelector (
  getRace,
  fmap (pipe (Race.A.attributeAdjustmentsSelection, fst))
)

export const getCurrentAttributeAdjustment = createMaybeSelector (
  getCurrentAttributeAdjustmentId,
  getAttributesForView,
  uncurryN (blackbirdF (liftM2 ((id: string) => find (pipe (AWRA.wikiEntry, AA.id, equals (id)))))
                       (join as join<Record<AttributeWithRequirements>>))
)

export const getAvailableAdjustmentIds = createMaybeSelector (
  getRace,
  getAdjustmentValue,
  getAttributesForView,
  getCurrentAttributeAdjustment,
  (mrace, madjustmentValue, mattrsCalculated, mcurr_attr) =>
    fmapF (mrace)
          (pipe (
            Race.A.attributeAdjustmentsSelection,
            snd,
            adjustmentIds => {
              if (isJust (mcurr_attr)) {
                const curr_attr = fromJust (mcurr_attr)

                const curr_attr_val = pipe_ (curr_attr, AWRA.stateEntry, ADA.value)

                if (or (pipe_ (curr_attr, AWRA.max, liftM2 (blackbirdF (subtractBy)
                                                                       (lt (curr_attr_val)))
                                                           (madjustmentValue)))) {
                  const curr_attr_id = pipe_ (curr_attr, AWRA.stateEntry, ADA.id)

                  return List (curr_attr_id)
                }
              }

              return filter ((id: string) => {
                              const mattr = bind (mattrsCalculated)
                                                 (find (pipe (AWRA.wikiEntry, AA.id, equals (id))))

                              if (isJust (mattr)) {
                                const attr = fromJust (mattr)

                                const mmax = AWRA.max (attr)

                                const mcurr_attr_id = fmapF (mcurr_attr)
                                                            (pipe (AWRA.stateEntry, ADA.id))

                                if (isNothing (mmax) || Maybe.elem (id) (mcurr_attr_id)) {
                                  return true
                                }

                                if (isJust (madjustmentValue)) {
                                  const attr_val = pipe_ (attr, AWRA.stateEntry, ADA.value)

                                  return maybe (true)
                                               (pipe (
                                                 add (fromJust (madjustmentValue)),
                                                 gte (attr_val)
                                               ))
                                               (mmax)
                                }
                              }

                              return false
                            })
                            (adjustmentIds)
            }
          ))
)
