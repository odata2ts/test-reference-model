# The "Library" Model in OData V2 and V3

Two reduced renditions of the reference model, one per pre-V4 protocol version:

- [`library-v2.xml`](library-v2.xml) — CSDL 2.0, `DataServiceVersion="2.0"`
- [`library-v3.xml`](library-v3.xml) — CSDL 3.0, `DataServiceVersion="3.0"`

They exist because the V4 model ([`library.xml`](library.xml)) cannot be used against a V2 or V3 server
at all — most of its headline features have no pre-V4 spelling — while a V2 or V3 server is exactly what
a great many real deployments still are.

## The one idea worth taking from this page

**The two files are a chain, not two independent models.** `library-v3.xml` is `library-v2.xml` plus
everything OData 3.0 adds, and nothing else. That mirrors how the versions actually relate — as
[the V1-V3 feature matrix][matrix-v1-v3] puts it, "2.0 and 3.0 add to their predecessor rather
than replacing it, and a 3.0 service is still a 2.0 service" — and it makes the **diff between the two
files the 3.0 delta**, expressed in a model rather than in prose:

```bash
diff model/library-v2.xml model/library-v3.xml
```

Two things in that diff are not the delta and should be read past: the CSDL namespace itself
(`…/2008/09/edm` → `…/2009/11/edm`, which the version bump requires) and the explanatory comments.
Everything else is a 3.0 feature. The domain, the type and property names, the schema namespaces and the
entity sets are identical between the two files, so nothing else can drift.

## How they were derived

The rule was mechanical, and applied in one direction only: **start from the V4 model, and remove what
the version cannot express.** Nothing was approximated to keep a feature alive. Where V4 has
`Edm.Duration` the V2 file has `Edm.Time` — same value, weaker type — but where V4 has an enum, V2 has a
plain `Edm.Byte` and the _feature_ is simply gone, recorded here rather than faked in the model. A
verdict measured against these files is therefore a verdict about the server, never about the rendition.

The version each construct belongs to comes from the
[V1-V3 feature matrix][matrix-v1-v3]; that matrix is the yardstick and this
model is what it looks like when instantiated.

## What each rendition contains

|                  |  V2 |  V3 |  V4 |
| ---------------- | --: | --: | --: |
| Entity types     |  18 |  19 |  20 |
| Complex types    |   8 |   9 |   9 |
| Enum types       |   0 |   2 |   2 |
| Associations     |   8 |   8 |   — |
| Association sets |   8 |   7 |   — |
| Entity sets      |  10 |  10 |  10 |
| Operations       |  26 |  26 |  29 |

The operation count barely moves, but what those operations _are_ changes completely — see below.

## V4 → V2: what falls away

| Feature in `library.xml`                       | V2  | Why                     | Consequence in `library-v2.xml`                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | :-: | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TypeDefinition` (`ISBN`)                      | ❌  | not before V4           | `PrintMedium.ISBN` is a plain `Edm.String`, MaxLength 13                                                                                                                                                                                                                                    |
| `EnumType` (`Amenities`, `AvailabilityStatus`) | ❌  | 3.0                     | `Branch.Amenities` → `Edm.Int32`, `Copy.Status` → `Edm.Byte`                                                                                                                                                                                                                                |
| Collection-valued properties                   | ❌  | 3.0                     | `Medium.Keywords` and `Member.PreviousAddresses` dropped                                                                                                                                                                                                                                    |
| Geospatial types                               | ❌  | 3.0                     | five `Branch` properties dropped; **`Bookmobile` dropped entirely**, it existed only for them                                                                                                                                                                                               |
| Named resource stream                          | ❌  | 3.0                     | `Audiobook.Sample` dropped                                                                                                                                                                                                                                                                  |
| Containment (`ContainsTarget`)                 | ❌  | 3.0                     | `AudiobookChapter` becomes an ordinary association with an entity set of its own                                                                                                                                                                                                            |
| `OpenType`, `Edm.Untyped`                      | ❌  | V4                      | **`CollectorsItem` dropped entirely**, it existed only for them                                                                                                                                                                                                                             |
| `Singleton`                                    | ❌  | V4                      | `MainBranch` dropped                                                                                                                                                                                                                                                                        |
| Alternate keys                                 | ❌  | V4                      | the `Core.AlternateKeys` annotation on `PrintMedium` dropped                                                                                                                                                                                                                                |
| Vocabularies / standard terms                  | ⚠️  | mechanism 3.0, terms V4 | `Core.OptimisticConcurrency` and `Capabilities.SearchRestrictions` dropped; `Core.Computed` and `Core.Immutable` survive as attribute annotations (`annotation:StoreGeneratedPattern`, `sap:creatable`/`sap:updatable`), `Core.ComputedDefaultValue` and `Core.Permissions` have no V2 form |
| `NavigationPropertyBinding`                    | ❌  | V4                      | replaced by `Association` / `AssociationSet` — see below                                                                                                                                                                                                                                    |
| Bound operations                               | ❌  | 3.0                     | the receiver becomes an ordinary key parameter                                                                                                                                                                                                                                              |
| Operation overloads                            | ❌  | V4                      | the two `Search` and the two `AvailableCopies` signatures collapse into one each                                                                                                                                                                                                            |
| Composable functions                           | ❌  | V4                      | `IsComposable` dropped from `NewReleases`, `AvailableCopies`                                                                                                                                                                                                                                |
| Complex / collection operation parameters      | ❌  | 3.0                     | `LoanStatistics(Period)` → two `Edm.DateTime` parameters; `CleanUpKeywords` loses its parameter                                                                                                                                                                                             |
| `Edm.Date`, `Edm.TimeOfDay`, `Edm.Duration`    | ❌  | V4                      | `Edm.DateTime` and `Edm.Time` carry the values                                                                                                                                                                                                                                              |

That last row has a consequence for keys. `library.xml` leaves them unannotated on purpose and lets each
implementation state what it really does (see _Design decisions_ in [`library.md`](library.md)) — but a V2
implementation has less to choose from. "The server generates it, and a client value is ignored" it can
say, with `sap:creatable="false"` and `sap:updatable="false"` or with `annotation:StoreGeneratedPattern`.
"The client may supply one, otherwise the server does" it cannot say at all. So a V2 server whose keys
behave like CAP's has to either overstate them as computed or stay silent, and that is a property of the
version rather than of the server.

Two entities are gone rather than reduced — `Bookmobile` and `CollectorsItem`. Both existed purely to
carry features V2 lacks, so a degraded version of them would have probed nothing while making the model
look larger than it is.

## What V2 says _better_ than V4

Worth naming, because the reduction is not loss all the way down:

- **`ConcurrencyMode="Fixed"`** on `Copy.Condition` is part of the schema language. V4 has to express the
  same thing as a `Core.OptimisticConcurrency` vocabulary annotation — which the first server measured
  against the V4 model emitted _empty_, naming no property at all
  ([test-server-cap](https://github.com/odata2ts/test-server-cap), FEATURE-COVERAGE.md §4.2). A client
  generating code from V2 metadata knows which property is the token; from that V4 document it does not.
- **`Association` / `AssociationSet`** make relationships explicit, with named roles, multiplicities and
  a referential constraint that reads in one place. V4's navigation property binding is terser and loses
  the role names.
- **The inheritance hierarchy is testable here.** `Medium → PrintMedium → Magazine → TradeJournal` is
  V4-legal too, but CAP — the first implementation measured — cannot express entity inheritance at all
  (FEATURE-COVERAGE.md §1.1), so no server has yet been measured against it. A V2 or V3 stack that does
  support `BaseType` finally puts that part of the model to work.

## V2 → V3: what comes back

Everything below is in `library-v3.xml` and not in `library-v2.xml`. This list is the 3.0 delta.

| Feature                      | Where in the model                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Enumeration types            | `Amenities` (`IsFlags`), `AvailabilityStatus` (`UnderlyingType="Edm.Byte"`); `Copy.Status`, `Branch.Amenities` typed by them   |
| Collection-valued properties | `Medium.Keywords` — `Collection(Edm.String)`; `Member.PreviousAddresses` — collection of a complex type                        |
| Geospatial types             | `Branch.Location`/`CatchmentArea`/`FloorPlanOrigin`/`FloorPlanShapes`, and `Bookmobile` returns                                |
| Named resource stream        | `Audiobook.Sample` — next to the entity's own media content                                                                    |
| Containment                  | `Audiobook.Chapters` gains `ContainsTarget="true"`; `AudiobookChapters` loses its entity set **and** its association set       |
| Vocabulary mechanism         | `ValueTerm IsRareHolding` + an `Annotations`/`ValueAnnotation` block on `EBook`                                                |
| Functions vs. actions        | `IsSideEffecting="false"` marks the 13 functions; the other 13 are actions                                                     |
| Bound operations             | `IsBindable="true"` on 13 of them, on both cardinalities (`medium` vs. `media`)                                                |
| `EntitySetPath`              | `AvailableCopy`, `AvailableCopies`, `Renew`, `RenewAll`                                                                        |
| Complex / collection params  | `LoanStatistics(Period: DateRange)`, `CleanUpKeywords(Obsolete: Collection(Edm.String))`, `BulkRenew(loans: Collection(Loan))` |

The operations are where 3.0 changes the most. In V2 all 26 are the same thing — a service operation
distinguished only by its HTTP method — and the bound half of the V4 model has to be re-expressed with
the receiver's key as an ordinary parameter (`LoanMetrics(MediumId)`). In V3 they split into 13 functions
and 13 actions, 13 of them bindable, and the V4 model's bound/unbound × return-type matrix is almost
fully restored. What still separates V3 from V4 here is composability and overloads.

Note that 3.0 does this **through attributes on `FunctionImport`**, not through separate schema elements:
`<Action>` and `<Function>` only arrive in V4.

## What is still missing in V3

Type definitions, singletons, open types, `Edm.Untyped`, alternate keys, navigation property binding,
composable functions, operation overloads, the `Edm.Date` / `Edm.TimeOfDay` / `Edm.Duration` trio, and
the standard vocabularies (3.0 has the mechanism, not the terms).

## Deliberately not instantiated

**Container inheritance** (`edm:Extends`, 3.0) is the one 3.0 schema construct these files do not carry.
Using it means declaring a second entity container, which changes the whole service surface — every
consumer has to decide which container it is talking to — for the sake of one attribute. The V4 model
makes the same kind of call for the `Multi*` geospatial variants: a feature that adds a large structure
for little discriminating power is recorded here instead of modelled.

## Validation

Both files are parsed **and semantically validated** with Microsoft's own CSDL reader
(`Microsoft.Data.Edm` 5.8.5, `EdmxReader.TryParse` + `IEdmModel.Validate`), which is the authoritative
implementation for CSDL 1.0–3.0. Both come back with zero parse errors and zero validation errors.

`library-v2.xml` additionally parses under [Apache Olingo](https://olingo.apache.org/) 2.0.13
(`EntityProvider.readMetadata(…, true)`), an independent, genuinely V2-only implementation — which
rejects `library-v3.xml` outright on its CSDL 3.0 namespace, as it should.

That second parser is worth keeping in the loop: it is stricter than Microsoft's on one point that
matters here, refusing a complex-typed parameter on a V2 `FunctionImport`. That is precisely the rule
that forced `LoanStatistics` to take two dates in the V2 rendition, and it was found by running the
parser, not by reading the spec.

[matrix-v1-v3]: https://odata2ts.github.io/odata-concepts/odata-v1-v3-feature-matrix
