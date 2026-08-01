# test-reference-model

The shared basis for evaluating OData implementations across the [odata2ts](https://github.com/odata2ts)
organisation: one feature-dense reference model to run implementations against, and a full inventory of
what the protocol actually offers to measure them by.

## The results

Everything in this repository exists for these four documents:

| Document                                                           | What it is                                                                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **[model/library.xml](model/library.xml)**                         | The reference model as EDMX — OData 4.01, 100 % CSDL-conformant. 20 entity types, 9 complex types, 29 operations |
| **[model/library.md](model/library.md)**                           | Its description: design decisions, namespace architecture, and the feature → model-location mapping              |
| **[feature-matrix/odata-v4.md](feature-matrix/odata-v4.md)**       | Every feature of OData 4.0 / 4.01, 296 rows, with conformance level and `MUST`/`SHOULD`/`MAY`                    |
| **[feature-matrix/odata-v1-v3.md](feature-matrix/odata-v1-v3.md)** | The same for OData 1.0 / 2.0 / 3.0, 201 rows, with the role the obligation falls on                              |

There is a fifth artifact, [model/quirks.xml](model/quirks.xml): a small companion fixture holding
**deliberately non-conformant** CSDL. It is kept separate so that a parser choking on it cannot poison
the main model.

## How the pieces fit together

The **feature matrices** answer "what is there, and how binding is it?" - purely from the OASIS and
Microsoft specifications, with no implementation in view. They are the yardstick.

The **model** is a probe, not a benchmark. It packs as much of the protocol as possible into one
coherent domain, deliberately in _combination_ - streaming inside an inheritance hierarchy, an open type
carrying navigation properties and bound operations - because per-feature mini-fixtures structurally
cannot express that. An implementation is run against it and the deviations are recorded.

Neither document rates anyone. **Where a concrete implementation stands is recorded in that
implementation's own repository**, so this one stays neutral and does not have to be touched whenever a
server or client changes:

- [test-server-cap](https://github.com/odata2ts/test-server-cap) - SAP CAP implementation of this model,
  with its `FEATURE-COVERAGE.md`. It is published as a container image and used by odata2ts's own
  integration tests.
- [odata2ts](https://github.com/odata2ts/odata2ts) - the generator and client libraries.

## Why the matrices cover four protocol versions in two documents

The split follows the sources rather than the version numbers. OData 1.0, 2.0 and 3.0 are described by a
single normative specification, [MS-ODATA], which does not mention 4.0 at all; they form one continuous
lineage where each version adds to its predecessor. The real break is between 3.0 and 4.0: a new
specification family (OASIS), `$links` becomes `$ref`, `DataServiceVersion` becomes `OData-Version`, and
conformance levels appear for the first time. Splitting there means one document per specification
family; splitting per version would cut one source into three overlapping pieces.

That break is also why the two matrices carry different columns. V4 grades features by **conformance
level** (`Min` / `Int` / `Adv` / `Upd`), which V1–V3 simply do not have - there, the meaningful axis is
**who** the obligation falls on (`Client` / `Server`). Both carry the `MUST` / `SHOULD` / `MAY` grading.

The single most consequential finding of the older matrix: across V1–V3 almost the entire query surface
is graded `MAY`. There is no level at which `$filter`, `$top` or even `eq` becomes mandatory, so a client
can assume nothing about a service's query capabilities. In V4 those same features are `MUST` from the
Intermediate level.

## Layout

| Path              | Contents                                                                     |
| ----------------- | ---------------------------------------------------------------------------- |
| `model/`          | The reference model: EDMX, its description, and the non-conformant companion |
| `feature-matrix/` | One document per specification family, independent of any implementation     |

## Conventions

Aligned with the other odata2ts repositories: Prettier (`printWidth` 120), EditorConfig (LF, UTF-8,
2 spaces), Conventional Commits with squash-merged PRs whose **title** is itself a valid commit message,
MIT licensed.

```bash
npm install
npm run format:check
```

The EDMX files under `model/` are excluded from Prettier on purpose. They are the deliverable:
hand-curated, heavily commented and byte-stable, so that consumers can diff their own `$metadata`
against them. Reformatting would produce noise in every such diff.

[MS-ODATA]: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-odata/
