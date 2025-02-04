import { equals } from "../../Data/Eq";
import { flip, ident, thrush } from "../../Data/Function";
import { fmap, fmapF } from "../../Data/Functor";
import { set } from "../../Data/Lens";
import { any, append, consF, filter, foldr, ifilter, imap, List, map, maximum, subscript, sum } from "../../Data/List";
import { altF_, bind, bindF, fromMaybe, guard, isJust, Just, liftM2, mapMaybe, Maybe, maybe, thenF } from "../../Data/Maybe";
import { add, dec, multiply, subtractBy } from "../../Data/Num";
import { elems, lookup, lookupF } from "../../Data/OrderedMap";
import { Record } from "../../Data/Record";
import { fst, isTuple, Pair, snd } from "../../Data/Tuple";
import { uncurryN } from "../../Data/Tuple/Curry";
import { AttributeDependent } from "../Models/ActiveEntries/AttributeDependent";
import { Belongings } from "../Models/Hero/Belongings";
import { HeroModel } from "../Models/Hero/HeroModel";
import { HitZoneArmor } from "../Models/Hero/HitZoneArmor";
import { fromItemTemplate, Item, ItemL } from "../Models/Hero/Item";
import { Armor } from "../Models/View/Armor";
import { HitZoneArmorForView } from "../Models/View/HitZoneArmorForView";
import { ItemForView, itemToItemForView } from "../Models/View/ItemForView";
import { MeleeWeapon } from "../Models/View/MeleeWeapon";
import { RangedWeapon } from "../Models/View/RangedWeapon";
import { ShieldOrParryingWeapon } from "../Models/View/ShieldOrParryingWeapon";
import { Attribute } from "../Models/Wiki/Attribute";
import { CombatTechnique } from "../Models/Wiki/CombatTechnique";
import { ItemTemplate } from "../Models/Wiki/ItemTemplate";
import { L10n } from "../Models/Wiki/L10n";
import { PrimaryAttributeDamageThreshold } from "../Models/Wiki/sub/PrimaryAttributeDamageThreshold";
import { WikiModel } from "../Models/Wiki/WikiModel";
import { createMaybeSelector } from "../Utilities/createMaybeSelector";
import { filterAndSortRecordsBy, filterAndSortRecordsByName } from "../Utilities/filterAndSortBy";
import { filterRecordsByName } from "../Utilities/filterBy";
import { getAttack, getParry } from "../Utilities/Increasable/combatTechniqueUtils";
import { convertPrimaryAttributeToArray } from "../Utilities/ItemUtils";
import { pipe, pipe_ } from "../Utilities/pipe";
import { filterByAvailability } from "../Utilities/RulesUtils";
import { sortRecordsByName } from "../Utilities/sortBy";
import { stringOfListToDropdown } from "../Views/Universal/Dropdown";
import { getRuleBooksEnabled } from "./rulesSelectors";
import { getEquipmentSortOptions } from "./sortOptionsSelectors";
import { getCurrentHeroPresent, getEquipmentFilterText, getEquipmentState, getHigherParadeValues, getHitZoneArmorsState, getItemsState, getItemTemplatesFilterText, getLocaleAsProp, getWiki, getWikiItemTemplates, getZoneArmorFilterText } from "./stateSelectors";

const HA = HeroModel.A
const WA = WikiModel.A
const BA = Belongings.A
const IA = Item.A
const ITA = ItemTemplate.A
const HZAA = HitZoneArmor.A
const IFVA = ItemForView.A
const IL = ItemL
const CTA = CombatTechnique.A
const PADTA = PrimaryAttributeDamageThreshold.A
const ADA = AttributeDependent.A
const AA = Attribute.A

export const getFullItem =
  (items: Belongings["items"]) =>
  (templates: WikiModel["itemTemplates"]) =>
  (id: string) =>
    pipe_ (
      items,
      lookup (id),
      fmap (item => {
        const is_template_locked = IA.isTemplateLocked (item)
        const template = IA.template (item)
        const where = IA.where (item)
        const amount = IA.amount (item)
        const loss = IA.loss (item)

        const mactive_template = bind (template) (lookupF (templates))

        return fromMaybe (item)
                               (pipe_ (
                                 is_template_locked,
                                 guard,
                                 thenF (mactive_template),
                                 fmap (pipe (
                                   fromItemTemplate (id),
                                   set (IL.where) (where),
                                   set (IL.amount) (amount),
                                   set (IL.loss) (loss)
                                 ))
                               ))
      }),
      altF_ (() => fmap (fromItemTemplate (id)) (lookup (id) (templates)))
    )

export const getTemplates = createMaybeSelector (
  getWikiItemTemplates,
  elems
)

export const getSortedTemplates = createMaybeSelector (
  getLocaleAsProp,
  getTemplates,
  uncurryN (l10n => tpls => sortRecordsByName (l10n) (tpls))
)

export const getAvailableItemTemplates = createMaybeSelector (
  getSortedTemplates,
  getRuleBooksEnabled,
  uncurryN (flip (filterByAvailability (ITA.src)))
)

export const getFilteredItemTemplates = createMaybeSelector (
  getItemTemplatesFilterText,
  getAvailableItemTemplates,
  uncurryN (filterText => xs => filterRecordsByName (filterText) (xs))
)

export const getItems = createMaybeSelector (
  getWikiItemTemplates,
  getItemsState,
  uncurryN (templates => fmap (items => pipe_ (
                                          items,
                                          elems,
                                          mapMaybe (pipe (IA.id, getFullItem (items) (templates)))
                                        )))
)

export const getFilteredItems = createMaybeSelector (
  getItems,
  getEquipmentFilterText,
  getEquipmentSortOptions,
  (mitems, filterText, sortOptions) =>
    fmapF (mitems)
          (filterAndSortRecordsBy (0)
                                  ([IA.name])
                                  (sortOptions)
                                  (filterText))
)

export const getHitZoneArmors = createMaybeSelector (
  getHitZoneArmorsState,
  fmap (elems)
)

export const getFilteredHitZoneArmors = createMaybeSelector (
  getHitZoneArmors,
  getZoneArmorFilterText,
  getLocaleAsProp,
  (mhitZoneArmors, filterText, l10n) =>
    fmapF (mhitZoneArmors)
          (filterAndSortRecordsByName (L10n.A.id (l10n))
                                      (filterText))
)

type HitZoneKeys =
  Exclude<
    keyof HitZoneArmor,
    "id"
    | "name"
    | "headLoss"
    | "leftArmLoss"
    | "rightArmLoss"
    | "torsoLoss"
    | "leftLegLoss"
    | "rightLegLoss"
  >

const getFullHitZoneItem =
  (items: Belongings["items"]) =>
  (templates: WikiModel["itemTemplates"]) =>
  (hitZone: HitZoneKeys) =>
    pipe (HitZoneArmor.A[hitZone], bindF (getFullItem (items) (templates)))

export const getAllItems = createMaybeSelector (
  getItemsState,
  getHitZoneArmorsState,
  getWikiItemTemplates,
  getLocaleAsProp,
  (mitems, mhitZoneArmors, templates, l10n) =>
    liftM2 ((items: Belongings["items"]) => (hitZoneArmors: Belongings["hitZoneArmors"]) => {
             const itemsList = elems (items)
             const hitZoneArmorsList = elems (hitZoneArmors)

             const mappedItems = pipe_ (
               itemsList,
               filter (pipe (IA.forArmorZoneOnly, equals<boolean> (false))),
               mapMaybe (pipe (IA.id, getFullItem (items) (templates), fmap (itemToItemForView)))
             )

             const mappedArmorZones =
               thrush (hitZoneArmorsList)
                      (map (hitZoneArmor => {
                        const headArmor = getFullHitZoneItem (items)
                                                             (templates)
                                                             ("head")
                                                             (hitZoneArmor)

                        const torsoArmor = getFullHitZoneItem (items)
                                                              (templates)
                                                              ("torso")
                                                              (hitZoneArmor)

                        const leftArmArmor = getFullHitZoneItem (items)
                                                                (templates)
                                                                ("leftArm")
                                                                (hitZoneArmor)

                        const rightArmArmor = getFullHitZoneItem (items)
                                                                 (templates)
                                                                 ("rightArm")
                                                                 (hitZoneArmor)

                        const leftLegArmor = getFullHitZoneItem (items)
                                                                (templates)
                                                                ("leftLeg")
                                                                (hitZoneArmor)

                        const rightLegArmor = getFullHitZoneItem (items)
                                                                 (templates)
                                                                 ("rightLeg")
                                                                 (hitZoneArmor)

                        const priceTotal = getPriceTotal (headArmor)
                                                         (leftArmArmor)
                                                         (leftLegArmor)
                                                         (rightArmArmor)
                                                         (rightLegArmor)
                                                         (torsoArmor)

                        const weightTotal = getWeightTotal (headArmor)
                                                           (leftArmArmor)
                                                           (leftLegArmor)
                                                           (rightArmArmor)
                                                           (rightLegArmor)
                                                           (torsoArmor)

                        return ItemForView ({
                          id: HZAA.id (hitZoneArmor),
                          name: HZAA.name (hitZoneArmor),
                          amount: 1,
                          price: Just (priceTotal),
                          weight: Just (weightTotal),
                          gr: 4,
                        })
                      }))

             return sortRecordsByName (L10n.A.id (l10n))
                                      (append (mappedArmorZones) (mappedItems))
           })
           (mitems)
           (mhitZoneArmors)
)

export const getTotalPrice = createMaybeSelector (
  getAllItems,
  fmap (foldr ((item: Record<ItemForView>) => maybe (ident as ident<number>)
                                                    (pipe (multiply (IFVA.amount (item)), add))
                                                    (IFVA.price (item)))
              (0))
)

export const getTotalWeight = createMaybeSelector (
  getAllItems,
  fmap (foldr ((item: Record<ItemForView>) => maybe (ident as ident<number>)
                                                    (pipe (multiply (IFVA.amount (item)), add))
                                                    (IFVA.weight (item)))
              (0))
)

export const getMeleeWeapons = createMaybeSelector (
  getCurrentHeroPresent,
  getHigherParadeValues,
  getWiki,
  (mhero, higherParadeValues, wiki) =>
    fmapF (mhero)
          (hero => {
            const items = pipe_ (hero, HA.belongings, BA.items)
            const rawItems = elems (items)

            const filteredItems =
              thrush (rawItems)
                     (filter (item => IA.gr (item) === 1
                                      || Maybe.elem (1) (IA.improvisedWeaponGroup (item))))

            const mapper = pipe (
              IA.id,
              getFullItem (items) (WA.itemTemplates (wiki)),
              bindF (
                full_item =>
                  pipe_ (
                    full_item,
                    IA.combatTechnique,
                    bindF (lookupF (WA.combatTechniques (wiki))),
                    bindF (
                      wiki_entry => {
                        const hero_entry = lookup (CTA.id (wiki_entry)) (HA.combatTechniques (hero))

                        const atBase = getAttack (hero) (wiki_entry) (hero_entry)
                        const at = atBase + Maybe.sum (IA.at (full_item))

                        const paBase = getParry (hero) (wiki_entry) (hero_entry)
                        const pa =
                          fmapF (paBase)
                                (pipe (
                                  add (Maybe.sum (IA.pa (full_item))),
                                  add (Maybe.sum (higherParadeValues))
                                ))

                        const mprimary_attr_ids =
                          fmapF (IA.damageBonus (full_item))
                                (damageBonus => fromMaybe (CTA.primary (wiki_entry))
                                                          (fmapF (PADTA.primary (damageBonus))
                                                                 (convertPrimaryAttributeToArray)))

                        const mprimary_attrs =
                          fmapF (mprimary_attr_ids)
                                (mapMaybe (lookupF (WA.attributes (wiki))))

                        const mprimary_attr_values =
                          fmapF (mprimary_attr_ids)
                                (map (pipe (
                                  lookupF (HA.attributes (hero)),
                                  maybe (8)
                                        (ADA.value)
                                )))

                        type Thresholds = number | Pair<number, number>

                        const damage_thresholds =
                          fromMaybe<Thresholds> (0)
                                                (fmapF (IA.damageBonus (full_item))
                                                       (PADTA.threshold))

                        const damage_flat_bonus =
                          fmapF (mprimary_attr_values)
                                (primary_attr_values =>
                                  isTuple (damage_thresholds)
                                    // P/T looks like "AGI 14/STR 15" and combat
                                    // technique has both attributes as primary
                                    // => maps them and look up the greatest
                                    // bonus
                                    ? pipe_ (
                                        primary_attr_values,
                                        imap (i => subtractBy (i === 0
                                                                ? fst (damage_thresholds)
                                                                : snd (damage_thresholds))),
                                        consF (0),
                                        maximum
                                      )
                                    : pipe_ (
                                        primary_attr_values,
                                        map (subtractBy (damage_thresholds)),
                                        consF (0),
                                        maximum
                                      )
                              )

                        const damageFlat =
                          Maybe.sum (liftM2 (add) (IA.damageFlat (full_item)) (damage_flat_bonus))

                        return fmapF (mprimary_attrs)
                                     (primary_attrs =>
                                       MeleeWeapon ({
                                         id: IA.id (full_item),
                                         name: IA.name (full_item),
                                         combatTechnique: CTA.name (wiki_entry),
                                         primary: map (AA.short) (primary_attrs),
                                         primaryBonus: damage_thresholds,
                                         damageDiceNumber: IA.damageDiceNumber (full_item),
                                         damageDiceSides: IA.damageDiceSides (full_item),
                                         damageFlat,
                                         atMod: IA.at (full_item),
                                         at,
                                         paMod: IA.pa (full_item),
                                         pa,
                                         reach: IA.reach (full_item),
                                         bf: CTA.bpr (wiki_entry)
                                           + Maybe.sum (IA.stabilityMod (full_item)),
                                         loss: IA.loss (full_item),
                                         weight: IA.weight (full_item),
                                         isImprovisedWeapon:
                                           isJust (IA.improvisedWeaponGroup (full_item)),
                                         isTwoHandedWeapon: IA.isTwoHandedWeapon (full_item),
                                       }))
                      }
                    )
                  )
              )
            )

            return mapMaybe (mapper) (filteredItems)
          })
)

export const getRangedWeapons = createMaybeSelector (
  getCurrentHeroPresent,
  getWiki,
  (mhero, wiki) =>
    fmapF (mhero)
          (hero => {
            const items = pipe_ (hero, HA.belongings, BA.items)
            const rawItems = elems (items)

            const filteredItems =
              thrush (rawItems)
                     (filter (item => IA.gr (item) === 2
                                      || Maybe.elem (2) (IA.improvisedWeaponGroup (item))))

            const mapper = pipe (
              IA.id,
              getFullItem (items) (WA.itemTemplates (wiki)),
              bindF (
                full_item =>
                  pipe_ (
                    full_item,
                    IA.combatTechnique,
                    bindF (lookupF (WA.combatTechniques (wiki))),
                    fmap (
                      wiki_entry => {
                        const hero_entry = lookup (CTA.id (wiki_entry)) (HA.combatTechniques (hero))

                        const atBase = getAttack (hero) (wiki_entry) (hero_entry)
                        const at = atBase + Maybe.sum (IA.at (full_item))

                        const ammunition =
                          pipe_ (
                            full_item,
                            IA.ammunition,
                            bindF (getFullItem (items) (WA.itemTemplates (wiki))),
                            fmap (IA.name)
                          )

                        return RangedWeapon ({
                          id: IA.id (full_item),
                          name: IA.name (full_item),
                          combatTechnique: CTA.name (wiki_entry),
                          reloadTime: IA.reloadTime (full_item),
                          damageDiceNumber: IA.damageDiceNumber (full_item),
                          damageDiceSides: IA.damageDiceSides (full_item),
                          damageFlat: IA.damageFlat (full_item),
                          at,
                          range: IA.range (full_item),
                          bf: CTA.bpr (wiki_entry)
                            + Maybe.sum (IA.stabilityMod (full_item)),
                          loss: IA.loss (full_item),
                          weight: IA.weight (full_item),
                          ammunition,
                        })
                      }
                    )
                  )
              )
            )

            return mapMaybe (mapper) (filteredItems)
          })
)

export const getStabilityByArmorTypeId = pipe (
  dec,
  subscript (List (4, 5, 6, 8, 9, 13, 12, 11, 10))
)

export const getEncumbranceHitZoneLevel = subscript (List (0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8))

export const getArmors = createMaybeSelector (
  getItemsState,
  getWiki,
  (mitems, wiki) =>
    fmapF (mitems)
          (items => {
            const rawItems = elems (items)

            const filteredItems =
              thrush (rawItems)
                     (filter (item => IA.gr (item) === 4))

            const mapper = pipe (
              IA.id,
              getFullItem (items) (WA.itemTemplates (wiki)),
              fmap (
                full_item => {
                  const addPenaltiesMod = IA.addPenalties (full_item) ? -1 : 0

                  return Armor ({
                    id: IA.id (full_item),
                    name: IA.name (full_item),
                    st: pipe_ (
                          full_item,
                          IA.armorType,
                          bindF (getStabilityByArmorTypeId),
                          fmap (add (Maybe.sum (IA.stabilityMod (full_item))))
                        ),
                    loss: IA.loss (full_item),
                    pro: IA.pro (full_item),
                    enc: IA.enc (full_item),
                    mov: addPenaltiesMod + Maybe.sum (IA.movMod (full_item)),
                    ini: addPenaltiesMod + Maybe.sum (IA.iniMod (full_item)),
                    weight: IA.weight (full_item),
                    where: IA.where (full_item),
                  })
                }
              )
            )

            return mapMaybe (mapper) (filteredItems)
          })
)

export const getArmorZones = createMaybeSelector (
  getWikiItemTemplates,
  getEquipmentState,
  uncurryN (templates =>
             fmap (belongings => {
                    const items = BA.items (belongings)
                    const rawHitZoneArmors = elems (BA.hitZoneArmors (belongings))

                    return thrush (rawHitZoneArmors)
                                  (map (hitZoneArmor => {
                                    const headArmor = getFullHitZoneItem (items)
                                                                         (templates)
                                                                         ("head")
                                                                         (hitZoneArmor)

                                    const torsoArmor = getFullHitZoneItem (items)
                                                                          (templates)
                                                                          ("torso")
                                                                          (hitZoneArmor)

                                    const leftArmArmor = getFullHitZoneItem (items)
                                                                            (templates)
                                                                            ("leftArm")
                                                                            (hitZoneArmor)

                                    const rightArmArmor = getFullHitZoneItem (items)
                                                                             (templates)
                                                                             ("rightArm")
                                                                             (hitZoneArmor)

                                    const leftLegArmor = getFullHitZoneItem (items)
                                                                            (templates)
                                                                            ("leftLeg")
                                                                            (hitZoneArmor)

                                    const rightLegArmor = getFullHitZoneItem (items)
                                                                             (templates)
                                                                             ("rightLeg")
                                                                             (hitZoneArmor)

                                    const proTotal = getProtectionTotal (headArmor)
                                                                        (leftArmArmor)
                                                                        (leftLegArmor)
                                                                        (rightArmArmor)
                                                                        (rightLegArmor)
                                                                        (torsoArmor)

                                    const weightTotal = getWeightTotal (headArmor)
                                                                       (leftArmArmor)
                                                                       (leftLegArmor)
                                                                       (rightArmArmor)
                                                                       (rightLegArmor)
                                                                       (torsoArmor)

                                    return HitZoneArmorForView ({
                                      id: HZAA.id (hitZoneArmor),
                                      name: HZAA.name (hitZoneArmor),
                                      head: bind (headArmor) (IA.pro),
                                      leftArm: bind (leftArmArmor) (IA.pro),
                                      leftLeg: bind (leftLegArmor) (IA.pro),
                                      rightArm: bind (rightArmArmor) (IA.pro),
                                      rightLeg: bind (rightLegArmor) (IA.pro),
                                      torso: bind (torsoArmor) (IA.pro),
                                      enc: Maybe.sum (getEncumbranceHitZoneLevel (proTotal)),
                                      addPenalties: [1, 3, 5].includes (proTotal),
                                      weight: weightTotal,
                                    })
                                  }))
                  }))
)

export const getShieldsAndParryingWeapons = createMaybeSelector (
  getCurrentHeroPresent,
  getWiki,
  (mhero, wiki) =>
    fmapF (mhero)
          (hero => {
            const items = pipe_ (hero, HA.belongings, BA.items)
            const rawItems = elems (items)

            const filteredItems =
              thrush (rawItems)
                     (filter (item => IA.gr (item) === 1
                                      && (
                                        Maybe.elem ("CT_10") (IA.combatTechnique (item))
                                        || IA.isParryingWeapon (item)
                                      )))

            const mapper = pipe (
              IA.id,
              getFullItem (items) (WA.itemTemplates (wiki)),
              bindF (
                full_item =>
                  pipe_ (
                    full_item,
                    IA.combatTechnique,
                    bindF (lookupF (WA.combatTechniques (wiki))),
                    fmap (
                      wiki_entry =>
                        ShieldOrParryingWeapon ({
                          id: IA.id (full_item),
                          name: IA.name (full_item),
                          stp: IA.stp (full_item),
                          bf: CTA.bpr (wiki_entry)
                            + Maybe.sum (IA.stabilityMod (full_item)),
                          loss: IA.loss (full_item),
                          atMod: IA.at (full_item),
                          paMod: IA.pa (full_item),
                          weight: IA.weight (full_item),
                        })
                    )
                  )
              )
            )

            return mapMaybe (mapper) (filteredItems)
          })
)

const getProtection = pipe (bindF (IA.pro), Maybe.sum)

const getProtectionTotal =
  (head: Maybe<Record<Item>>) =>
  (leftArm: Maybe<Record<Item>>) =>
  (leftLeg: Maybe<Record<Item>>) =>
  (rightArm: Maybe<Record<Item>>) =>
  (rightLeg: Maybe<Record<Item>>) =>
  (torso: Maybe<Record<Item>>) => {
    const total =
      sum (List (
        getProtection (head) * 1,
        getProtection (torso) * 5,
        getProtection (leftArm) * 2,
        getProtection (rightArm) * 2,
        getProtection (leftLeg) * 2,
        getProtection (rightLeg) * 2
      ))

    return Math.ceil (total / 14)
  }

const getWeight = pipe (bindF (IA.weight), Maybe.sum)

const getWeightTotal =
  (head: Maybe<Record<Item>>) =>
  (leftArm: Maybe<Record<Item>>) =>
  (leftLeg: Maybe<Record<Item>>) =>
  (rightArm: Maybe<Record<Item>>) =>
  (rightLeg: Maybe<Record<Item>>) =>
  (torso: Maybe<Record<Item>>) => {
    const total =
      sum (List (
        getWeight (head) * 0.5,
        getWeight (torso) * 0.1,
        getWeight (leftArm) * 0.1,
        getWeight (rightArm) * 0.1,
        getWeight (leftLeg) * 0.1,
        getWeight (rightLeg) * 0.1
      ))

    return Math.floor (total * 100) / 100
  }

const getPrice = pipe (bindF (IA.price), Maybe.sum)

const getPriceTotal =
  (head: Maybe<Record<Item>>) =>
  (leftArm: Maybe<Record<Item>>) =>
  (leftLeg: Maybe<Record<Item>>) =>
  (rightArm: Maybe<Record<Item>>) =>
  (rightLeg: Maybe<Record<Item>>) =>
  (torso: Maybe<Record<Item>>) => {
    const total =
      sum (List (
        getPrice (head) * 0.5,
        getPrice (torso) * 0.1,
        getPrice (leftArm) * 0.1,
        getPrice (rightArm) * 0.1,
        getPrice (leftLeg) * 0.1,
        getPrice (rightLeg) * 0.1
      ))

    return Math.floor (total * 100) / 100
  }

export const getProtectionAndWeight =
  (getZoneArmor: (id: Maybe<string>) => Maybe<Record<Item>>) =>
  (hitZoneArmor: Record<HitZoneArmor>) => {
    const headArmor = getZoneArmor (HZAA.head (hitZoneArmor))
    const torsoArmor = getZoneArmor (HZAA.torso (hitZoneArmor))
    const leftArmArmor = getZoneArmor (HZAA.leftArm (hitZoneArmor))
    const rightArmArmor = getZoneArmor (HZAA.rightArm (hitZoneArmor))
    const leftLegArmor = getZoneArmor (HZAA.leftLeg (hitZoneArmor))
    const rightLegArmor = getZoneArmor (HZAA.rightLeg (hitZoneArmor))

    const protectionSum =
      sum (List (
        getProtection (headArmor) * 1,
        getProtection (torsoArmor) * 5,
        getProtection (leftArmArmor) * 2,
        getProtection (rightArmArmor) * 2,
        getProtection (leftLegArmor) * 2,
        getProtection (rightLegArmor) * 2
      ))

    const weightSum =
      sum (List (
        getWeight (headArmor) * 0.5,
        getWeight (torsoArmor) * 0.1,
        getWeight (leftArmArmor) * 0.1,
        getWeight (rightArmArmor) * 0.1,
        getWeight (leftLegArmor) * 0.1,
        getWeight (rightLegArmor) * 0.1
      ))

    return {
      pro: protectionSum,
      weight: weightSum,
    }
  }

const getItemGroupsAsDropdowns = pipe (L10n.A.itemgroups, imap (stringOfListToDropdown))

const isAnyTplOfGr = (gr_name_index: number) => any (pipe (ITA.gr, equals (gr_name_index + 1)))

const filterGrsIfAnyTplAvailable =
  (tpls: List<Record<ItemTemplate>>) =>
    pipe (
      getItemGroupsAsDropdowns,
      ifilter (i => () => isAnyTplOfGr (i) (tpls))
    )

export const getAvailableSortedEquipmentGroups = createMaybeSelector (
  getLocaleAsProp,
  getAvailableItemTemplates,
  uncurryN (l10n => pipe (
                      flip (filterGrsIfAnyTplAvailable) (l10n),
                      sortRecordsByName (l10n)
                    ))
)
