# OData Server Feature Test Model "Library"

A deliberately feature-dense OData **V4.01** data model for evaluating OData server implementations
("which server actually supports which spec feature"). The domain (a public library) is intuitive but
not meant to be domain-accurate — every modeling decision serves feature coverage, ideally in
_combination_ (e.g. streaming inside an inheritance hierarchy), not realism.

Companion artifacts:

- [`library.xml`](library.xml) — the main EDMX (`$metadata`)
  document, 100% CSDL-conformant.
- [`quirks.xml`](quirks.xml) — a tiny separate "torture"
  fixture containing deliberately non-conformant constructs (see below).
- [`library-v2.xml`](library-v2.xml) / [`library-v3.xml`](library-v3.xml) — reduced renditions for the
  older protocol versions, described in [`library-v2-v3.md`](library-v2-v3.md).

The model deliberately includes features the odata2ts client currently does **not** (fully) support per
the odata2ts client coverage notes — composable
functions, operation overloads, `Edm.Stream`/media entities, `Edm.Binary`, geo types, `Edm.Untyped`,
flags enums — precisely so that both server and client gaps become visible.

Related prior art: [odata2ts#160](https://github.com/odata2ts/odata2ts/issues/160) "Common Data Model
for Test Server Implementations" (open) — the odata2ts maintainer's own proposal for exactly this kind
of shared test model; a potential place to contribute this model back to.

## Design decisions

**One cohesive model** instead of several small single-purpose fixtures: the point is feature
_combinations_ (streaming + inheritance, open type + navigation + bound operations, media entity and
named stream property side by side), which per-feature mini-models structurally cannot express. Exotic
types (geo family, `Edm.Untyped`, flags enum) sit on domain-peripheral entities (Branch, Bookmobile,
CollectorsItem) so a server choking on them doesn't invalidate the domain core.

**Non-conformant constructs are quarantined** in the separate quirks fixture: a single invalid
identifier can make a strict server/client reject the **entire** `$metadata` document, silently voiding
every other feature verdict. The main model stays 100% parseable; the quirks file yields its own
separate parse-level verdict.

**V4.01**: `Edm.Untyped` requires `Version="4.01"`. Most headline features (actions with all return-type
variants, open types, overloads, composable functions, modern scalar types) are structurally impossible
in V2 CSDL, so the older versions get **reduced models of their own** rather than a downgrade of this
one — [`library-v2.xml`](library-v2.xml) and [`library-v3.xml`](library-v3.xml), see
[`library-v2-v3.md`](library-v2-v3.md). Nothing is approximated there: what a version cannot express is
absent, so a verdict stays a verdict about the implementation.

## Namespace architecture

| Namespace             | Purpose                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Library.Catalog`     | Media hierarchy, complex types, enums, TypeDefinition                                                                  |
| `Library.Circulation` | Member, Copy, Loan, Branch, all operations                                                                             |
| `PublisherRegistry`   | Standalone namespace (no `Library.` prefix) — simulates an external system; deliberately reuses the type name `Branch` |
| `Library.Service`     | Container only: entity sets, singleton, function/action imports                                                        |

Several operations are defined in `Library.Circulation` but **bound to types from `Library.Catalog`**
(`AvailableCopy`, `AvailableCopies`, `LoanMetrics`, `AvailableLanguages`, `Reserve`) — cross-namespace
binding as a first-class test case.

## Entity/ComplexType/Enum overview

### `Library.Catalog`

| Name               | Kind                                  | Core properties (data type)                                                                                                                                                                                                                  | BaseType    | Abstract | Open    |
| ------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ------- |
| ISBN               | **TypeDefinition**                    | UnderlyingType `Edm.String`, MaxLength 13                                                                                                                                                                                                    | –           | –        | –       |
| Medium             | EntityType                            | Id: Guid (Key), Title: String (Nullable=false, MaxLength 200), Language: String, PublicationDate: Date, Keywords: Collection(String), PopularityScore: Double (`Core.Computed`), Nav. `Copies` → Collection(Copy) (Partner of Copy.`Medium`) | –           | **yes**  | no      |
| PrintMedium        | EntityType                            | ISBN: `Library.Catalog.ISBN` (**alternate key** via `Core.AlternateKeys`)                                                                                                                                                                    | Medium      | **yes**  | no      |
| Book               | EntityType                            | PageCount: Int16, AgeRating: Byte, Nav. `Publisher` → `PublisherRegistry.Publisher` (Partner of Publisher.`Books`)                                                                                                                           | PrintMedium | no       | no      |
| Magazine           | EntityType                            | IssueNumber: Int32                                                                                                                                                                                                                           | PrintMedium | no       | no      |
| TradeJournal       | EntityType                            | Field: String                                                                                                                                                                                                                                | Magazine    | no       | no      |
| AudioMedium        | EntityType                            | Duration: Duration                                                                                                                                                                                                                           | Medium      | **yes**  | no      |
| Audiobook          | EntityType                            | Narrator: String, **Sample: Stream** (named stream property), Nav. `Chapters` → Collection(AudiobookChapter) (**ContainsTarget=true**, containment)                                                                                          | AudioMedium | no       | no      |
| AudiobookChapter   | EntityType, **HasStream**             | Id: Int32 (Key), Title: String — only addressable through its Audiobook                                                                                                                                                                      | –           | no       | no      |
| DVD                | EntityType                            | RegionCode: Byte                                                                                                                                                                                                                             | AudioMedium | no       | no      |
| EBook              | EntityType, **HasStream**             | FileFormat: String — media entity **inside an inheritance hierarchy**                                                                                                                                                                        | Medium      | no       | no      |
| CollectorsItem     | EntityType                            | ExtraData: **Edm.Untyped**, Nav. `StorageLocation` → Branch (Partner-less, unidirectional)                                                                                                                                                   | Medium      | no       | **yes** |
| ConditionReport    | ComplexType                           | ConditionBefore/After: Byte, Remark: String                                                                                                                                                                                                  | –           | –        | –       |
| MediumStats        | ComplexType                           | TotalLoanCount: Int64, AverageLoanDuration: Duration                                                                                                                                                                                         | –           | –        | –       |
| Address            | ComplexType                           | Street: String, City: String                                                                                                                                                                                                                 | –           | **yes**  | –       |
| PostalAddress      | ComplexType                           | PostalCode: String, Country: String                                                                                                                                                                                                          | Address     | no       | –       |
| Amenities          | EnumType, **IsFlags**                 | WheelchairAccessible=1, Parking=2, **`Café`=4** (non-ASCII, spec-conformant), KidsArea=8, StudyRoom=16, **FullService=31** (combined member — legal; `IsFlags` does not mandate powers of two; exercises `has`)                              | –           | –        | –       |
| AvailabilityStatus | EnumType, **UnderlyingType=Edm.Byte** | Available, OnLoan, InRepair, Missing                                                                                                                                                                                                         | –           | –        | –       |

### `Library.Circulation`

| Name                                   | Kind        | Core properties                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Member                                 | EntityType  | Id: Int32 (Key), Name: String (Nullable=false, MaxLength 100), DateOfBirth: Date, Address: PostalAddress, **PreviousAddresses: Collection(PostalAddress)** (collection of complex — no existing fixture has this), ActiveSince: DateTimeOffset (Precision 7), Balance: Decimal (Precision 9, Scale 2), Nav. `Loans` → Collection(Loan) (Partner, **OnDelete Cascade**), Nav. `Reservations`, Nav. `IdDocument` (to-one)                                                                                |
| Copy                                   | EntityType  | **MediumId: Guid + InventoryNumber: Int32 (composite key)**, Condition: Byte, IsLoanable: Boolean (Nullable=false, **DefaultValue=true**), Status: AvailabilityStatus, AcquisitionDate: Date, WeightKg: Single, `Location_`: String (**Unicode=false**; trailing underscore deliberately collides with the nav. property `Location` under a client renaming strategy, cf. odata2ts#142), Nav. `Medium` (Partner of Medium.`Copies`, **ReferentialConstraint** MediumId → Id), Nav. `Location` → Branch |
| Loan                                   | EntityType  | Id: Guid (Key), LoanedAt: DateTimeOffset (Nullable=false, Precision 7), DueDate: Date (Nullable=false), ReturnedAt: DateTimeOffset (nullable — explicit-`null`-vs-absent test case), LateFee: Decimal (Precision 5, Scale 2 — deliberately different from Member.Balance), Nav. `Member` (Partner of Member.`Loans`), Nav. `Copy`                                                                                                                                                                      |
| Reservation                            | EntityType  | Id: Guid (Key), ReservedAt: DateTimeOffset                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| IdDocument                             | EntityType  | Id: Guid (Key), **Scan: Binary** (upload via PATCH, download via `…/Scan/$value`), UploadedAt: DateTimeOffset                                                                                                                                                                                                                                                                                                                                                                                          |
| Branch                                 | EntityType  | Id: Int32 (Key), Name: String, Address: PostalAddress, **Location: GeographyPoint (SRID 4326)**, **CatchmentArea: GeographyPolygon (SRID 4326)**, LowestFloor: **SByte**, **FloorPlanOrigin: GeometryPoint (SRID 0)**, **FloorPlanShapes: GeometryCollection (SRID 0)**, OpensAt/ClosesAt: TimeOfDay, Amenities: Amenities, Population: Int64                                                                                                                                                          |
| Bookmobile                             | EntityType  | Id: Int32 (Key), LicensePlate: String, **Route: GeographyLineString**, CurrentPosition: GeographyPoint                                                                                                                                                                                                                                                                                                                                                                                                 |
| OverdueNotice                          | ComplexType | Reason: String, Amount: Decimal, CreatedAt: DateTimeOffset                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LoanStats / BranchStats / AnnualReport | ComplexType | various figures (Int64, Decimal, Duration)                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| DateRange                              | ComplexType | From: Date, To: Date                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### `PublisherRegistry`

| Name      | Kind       | Core properties                                                                                                                                                |
| --------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publisher | EntityType | Id: Int32 (Key), Name: String, Country: String, Founded: Date, Nav. `Books` → Collection(Book) (Partner)                                                       |
| Branch    | EntityType | Id: Int32 (Key), City: String, Country: String — **same type name as `Library.Circulation.Branch`, deliberately, in a different namespace** (cf. odata2ts#222) |

### `Library.Service` (container)

Entity sets `Media`, `Copies`, `Members`, `Loans`, `Reservations`, `IdDocuments`, `Branches`,
`Bookmobiles`, `Publishers`, `PublisherBranches`; **Singleton `MainBranch`** (Branch);
`NavigationPropertyBinding` for every navigation target, including **type-cast paths** for derived-type
navigations (`Library.Catalog.Book/Publisher` → `Publishers`); function/action imports for all unbound
operations, with `EntitySet` on the entity-returning ones. Annotations: `Capabilities.SearchRestrictions`
(Searchable) on `Media`, `Core.OptimisticConcurrency` (ETag property: Condition) on `Copies`.

## EDM primitives → model location

| EDM type | Property               | EDM type                              | Property                                                      |
| -------- | ---------------------- | ------------------------------------- | ------------------------------------------------------------- |
| String   | Medium.Title           | Guid                                  | Medium.Id                                                     |
| Boolean  | Copy.IsLoanable        | Date                                  | Medium.PublicationDate                                        |
| Byte     | Book.AgeRating         | DateTimeOffset                        | Loan.LoanedAt                                                 |
| SByte    | Branch.LowestFloor     | TimeOfDay                             | Branch.OpensAt                                                |
| Int16    | Book.PageCount         | Duration                              | AudioMedium.Duration                                          |
| Int32    | Magazine.IssueNumber   | **Binary**                            | **IdDocument.Scan**                                           |
| Int64    | Branch.Population      | **Stream**                            | Audiobook.Sample (named) + EBook/AudiobookChapter (HasStream) |
| Single   | Copy.WeightKg          | GeographyPoint / LineString / Polygon | Branch.Location / Bookmobile.Route / Branch.CatchmentArea     |
| Double   | Medium.PopularityScore | GeometryPoint / GeometryCollection    | Branch.FloorPlanOrigin / Branch.FloorPlanShapes               |
| Decimal  | Member.Balance         | Untyped (4.01)                        | CollectorsItem.ExtraData                                      |

Remaining geo sub-family (MultiPoint/MultiLineString/MultiPolygon) deliberately not instantiated —
Point, LineString, Polygon and the compound GeometryCollection case, each with explicit `SRID`, give a
per-shape verdict; the Multi* variants add little discriminating power.

## Operations

**Functions** — every combination of {bound, unbound} × {primitive, Collection(primitive), complex,
Collection(complex), entity, Collection(entity)}:

| Name                | bound | Bound to                 | Parameters                                                                                                   | ReturnType                         | Composable | Overload                    |
| ------------------- | ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ---------- | --------------------------- |
| TotalMediaCount     | –     | –                        | –                                                                                                            | Edm.Int64                          | no         | no                          |
| AllLanguages        | –     | –                        | –                                                                                                            | Collection(Edm.String)             | no         | no                          |
| LoanStatistics      | –     | –                        | `Period: DateRange` (complex parameter → `@p1` aliasing tests, cf. odata2ts#285/#291)                        | LoanStats (complex)                | no         | no                          |
| StatsPerBranch      | –     | –                        | –                                                                                                            | Collection(BranchStats)            | no         | no                          |
| MostReadMedium      | –     | –                        | –                                                                                                            | Medium (entity, abstract)          | no         | no                          |
| NewReleases         | –     | –                        | –                                                                                                            | Collection(Medium)                 | **yes**    | no                          |
| Search (a)          | –     | –                        | `Term: String`                                                                                               | Collection(Medium)                 | no         | **yes**                     |
| Search (b)          | –     | –                        | `Term: String, MaxResults: Int32` (overloads differ in number/types of parameters — names alone don't count) | Collection(Medium)                 | no         | **yes**                     |
| OutstandingBalance  | ✓     | Member                   | –                                                                                                            | Edm.Decimal                        | no         | no                          |
| AvailableLanguages  | ✓     | Collection(Medium)       | –                                                                                                            | Collection(Edm.String)             | no         | no                          |
| LoanMetrics         | ✓     | Medium                   | –                                                                                                            | MediumStats (complex)              | no         | no                          |
| NoticeHistory       | ✓     | Member                   | –                                                                                                            | Collection(OverdueNotice)          | no         | no                          |
| AvailableCopy       | ✓     | Medium (cross-namespace) | –                                                                                                            | Copy (entity, `EntitySetPath`)     | no         | no                          |
| AvailableCopies (a) | ✓     | Medium                   | –                                                                                                            | Collection(Copy) (`EntitySetPath`) | **yes**    | **yes**                     |
| AvailableCopies (b) | ✓     | Collection(Medium)       | –                                                                                                            | Collection(Copy) (`EntitySetPath`) | **yes**    | **yes** (binding-type axis) |

**Actions** — same matrix plus the no-return case (only actions may omit a return type); actions are
never `IsComposable`:

| Name                  | bound | Bound to         | Parameters                                                                 | ReturnType                         |
| --------------------- | ----- | ---------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| ClosureDay            | –     | –                | Date: Date                                                                 | – (none)                           |
| NextInventoryNumber   | –     | –                | –                                                                          | Edm.Int32                          |
| CleanUpKeywords       | –     | –                | `Obsolete: Collection(Edm.String)` (collection parameter, cf. odata2ts#72) | Collection(Edm.String)             |
| YearEndClosing        | –     | –                | Year: Int32                                                                | AnnualReport (complex)             |
| RunOverdueNotices     | –     | –                | –                                                                          | Collection(OverdueNotice)          |
| AcquireCollectorsItem | –     | –                | Title, Description: String                                                 | CollectorsItem (entity)            |
| RunStockCheck         | –     | –                | –                                                                          | Collection(Medium)                 |
| CheckOut              | ✓     | Copy             | MemberId: Int32                                                            | – (none)                           |
| Reserve               | ✓     | Medium           | MemberId: Int32                                                            | Edm.Int32                          |
| BulkRenew             | ✓     | Collection(Loan) | –                                                                          | Collection(Edm.String)             |
| AssessCondition       | ✓     | Copy             | NewCondition: Byte, Remark: String                                         | ConditionReport (complex)          |
| RunReminders          | ✓     | Member           | –                                                                          | Collection(OverdueNotice)          |
| Renew                 | ✓     | Loan             | –                                                                          | Loan (entity, `EntitySetPath`)     |
| RenewAll              | ✓     | Collection(Loan) | –                                                                          | Collection(Loan) (`EntitySetPath`) |

## Feature → model location

| #   | Feature                                                                                                                   | Where                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | All EDM data types                                                                                                        | primitives table above                                                                                                                                                                                                                                                                                                   |
| 2   | All return types, bound+unbound — incl. both binding cardinalities (bound to a single entity vs. to an entity collection) | 15 functions + 14 actions (incl. overload variants); entity-bound (e.g. `OutstandingBalance`, `LoanMetrics`, `CheckOut`, `Renew`) and collection-bound (e.g. `AvailableLanguages`, `BulkRenew`, `RenewAll`) on both functions and actions — a distinction that barely shows in the EDMX but drives client/server routing |
| 3   | BaseTypes/inheritance                                                                                                     | Medium→PrintMedium→Magazine→TradeJournal (4 levels); Medium→AudioMedium→Audiobook/DVD; ComplexType Address→PostalAddress                                                                                                                                                                                                 |
| 4   | Abstract & Open types                                                                                                     | Abstract: Medium, PrintMedium, AudioMedium, Address; Open: CollectorsItem (derived from abstract + navigation)                                                                                                                                                                                                           |
| 5   | Multiple schemas                                                                                                          | 4 namespaces; cross-namespace bindings and operations                                                                                                                                                                                                                                                                    |
| 6   | Function overloads                                                                                                        | `Search` (parameter axis), `AvailableCopies` (binding-type axis)                                                                                                                                                                                                                                                         |
| 7   | Composable functions                                                                                                      | `NewReleases`, `AvailableCopies` a+b — all Collection(entity) with resolvable entity set                                                                                                                                                                                                                                 |
| 8   | Stream functionality                                                                                                      | EBook + AudiobookChapter (HasStream media entities), Audiobook.Sample (named stream) — both inside inheritance hierarchies, side by side                                                                                                                                                                                 |
| 9   | Binaries upload/download                                                                                                  | IdDocument.Scan (`Edm.Binary`), actively used                                                                                                                                                                                                                                                                            |

Extended CSDL features beyond the original nine: TypeDefinition, containment navigation, singleton,
alternate keys, optimistic-concurrency annotation, referential constraint, OnDelete Cascade, enum
underlying type, DefaultValue, facets (MaxLength/Precision/Scale/SRID/Unicode/Nullable), collection of
complex type, uni- vs. bidirectional navigation, NavigationPropertyBinding (incl. type-cast paths),
`edmx:Reference` vocabulary includes.

## Companion torture fixture (`quirks.xml`)

Single namespace `Library.Quirks`, containing only constructs a strict CSDL validator may reject
outright — kept out of the main model so they cannot poison whole-document `$metadata` parsing:

- EntityType `LegacyRecord` with properties **`Call Number`** (space, cf. odata2ts#335 / Claris
  FileMaker) and **`Author/Editor`** (raw `/`, colliding with the OData path separator).
- **`ReservedCategory`**: an EnumType with zero members (cf. odata2ts#270). Verified against the OASIS
  `edm.xsd`: `TEnumType` declares `xs:choice minOccurs="1"` over Member/Annotation children, so a fully
  empty EnumType is XSD-invalid — deliberately non-conformant, which is the point of this file.

Both constructs are XML-well-formed; the violations exist at CSDL level only, so the file exercises
CSDL validation, not XML parsing.

## Protocol/query-behavior test scenarios (no structural model change needed)

- `$batch` requests (odata2ts#253)
- `POST /EntitySet/$query` — query options in a `text/plain` body (odata2ts#383/#388)
- `$expand` rejected on non-navigation properties, e.g. `Medium.Keywords` (odata2ts#372/#379)
- Deep `$select`/`$expand` into complex types (`$select=Address/City` on Member), also combined with PATCH/POST (odata2ts#391/#393)
- `$count`/`$orderby` inside `$expand`, e.g. `$expand=Copies($count=true)` (odata2ts#344/#371)
- `$apply`/aggregation, e.g. `groupby((Status), aggregate($count as Count))` on Copies
- Query options on composable function results (`NewReleases()/…`, odata2ts#346)
- Long `in()` filter chains, 15+ values (server recursion limits, odata2ts#337)
- Operator-precedence-sensitive `$filter` (odata2ts#373); `cast()` in `$filter` against the Medium hierarchy (odata2ts#323)
- Explicit `null` vs. omitted property (Loan.ReturnedAt, odata2ts#257/#218)
- `@odata.type` discriminator in write payloads (create Book via Media, odata2ts#257)
- ETag round-trip via the `Core.OptimisticConcurrency`-annotated Copies set (If-Match/412)
- Alternate-key addressing: `Media(ISBN='…')` style resource paths
- CSRF token handshake (`X-CSRF-Token: Fetch`) as a required step in write-scenario scripts (odata2ts#200)

## Explicitly out of scope

- **Keyless concrete entity types** (Dynamics-365-style, odata2ts#241/#247) — a spec-ambiguous
  real-world behavior; belongs in a further dedicated non-strict fixture if needed, not here.
- **V2/V3 literal quirks** (`guid'…'`, `datetime'…'`, `L`/`M`/`D` suffixes, odata2ts#35/#338/#47/#84) —
  these are URL and payload conventions, not model constructs, so they belong to a server's test
  scenarios rather than to the EDMX. The models themselves now exist:
  [`library-v2.xml`](library-v2.xml), [`library-v3.xml`](library-v3.xml).
- **Large-schema stress variant** (15MB+ `$metadata`, odata2ts#244/#251) — possible later generated
  variant of this model.
- **`Collection(primitive)` operation return type combined with an active client-side value converter**
  (Big Number, Luxon) — none of this model's existing `Collection(primitive)` returns (`AllLanguages`,
  `AvailableLanguages`, `CleanUpKeywords`, `BulkRenew`; all `Collection(Edm.String)`) exercise this, since
  `Edm.String` needs no converter. The gap is a confirmed **odata2ts client bug**, not a server-observable
  behavior difference (the CSDL for `Collection(Edm.Decimal)` looks identical regardless of whether the
  client applies a converter) — see the odata2ts client coverage notes, §7/§17, for the reproduction.
  Deliberately not instantiated here for that reason; tracked instead as its own client-side fix task.
