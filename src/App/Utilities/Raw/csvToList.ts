import { bindF, Either, Left, maybeToEither, Right } from "../../../Data/Either";
import { fmap } from "../../../Data/Functor";
import { cons, empty, filter, findIndex, flength, head, ifoldr, lines, List, map, notNull, notNullStr, replaceStr, splitOn, take, uncons, zip } from "../../../Data/List";
import { ensure, fromMaybe_, mapMaybe } from "../../../Data/Maybe";
import { fromList, OrderedMap } from "../../../Data/OrderedMap";
import { show } from "../../../Data/Show";
import { fst, Pair, second, snd } from "../../../Data/Tuple";
import { pipe } from "../pipe";

// const file = xlsx.readFile(`${dataSrcPath}TDE5.xlsx`);
// const allWorksheets = file.SheetNames.reduce((m, name) => {
//   return m.set(name, xlsx.utils.sheet_to_csv(file.Sheets[name], { FS: ';;',
// RS: '\n', blankrows: false }));
// }, new Map());

type Data = List<OrderedMap<string, string>>

export const CsvColumnDelimiter = ";;"

const emptyColRegex = /(?:^(?:Spalte|Column)\d+$)|(?:^_)/

/**
 * Converts a CSV string into a list of entries. If `check` is `True`, the line
 * length will be checked so there is no difference in length. Error info is
 * contained in the returned `Either`.
 */
export const csvToList =
  pipe (
    lines,

    // Split lines into columns
    map (splitOn (CsvColumnDelimiter)),

    // Ignore lines that are accidentially contained in CSV
    // => array of length 1, containing empty string
    filter<List<string>> (e => notNull (e) && head (e) .length > 0),

    // header and body
    uncons,

    x => x,

    maybeToEither ("csvToList: Empty file"),

    bindF (headerAndBody => {
            const header = fst (headerAndBody)

            const header_length = flength (header)

            const valid_header_length =
              fromMaybe_ (() => flength (header))
                         (findIndex ((x: string) => x .length === 0 || emptyColRegex .test (x))
                                    (header))

            const valid_header = take (valid_header_length) (header)

            if (valid_header_length === 0) {
              return Left (
                `csvToList: empty worksheet, table header: \n${show (header)}`
              )
            }

            const body = snd (headerAndBody)

            return ifoldr<List<string>, Either<string, Data>>
              (i => l =>
                bindF (
                  acc => flength (l) !== header_length
                    ? Left (
                      `csvToList: Line ${i + 1} has different length than header.`
                      + ` Check if there are any newline characters ("\\n") on that line.`
                      + ` Source: ${show (l)}`
                    )
                    : Right (cons (acc)
                                  (fromList (mapMaybe (decode)
                                                      (zip (valid_header) (l)))))
                ))
              (Right (empty))
              (body)
          })
  )

const unescapeStr =
  (x: string) => {
    const res = /^"(.+)"$/ .exec (x)

    if (res !== null && typeof res [1] === "string") {
      return replaceStr ("\"\"") ("\"") (res [1])
    }

    return x
  }

const decodeLF = replaceStr ("\\n") ("\n")

const decode =
  pipe (
    ensure<Pair<string, string>> (pipe (snd, notNullStr)),
    fmap (second (pipe (unescapeStr, decodeLF)))
  )
