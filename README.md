# Mülk Chain

**Institutional Real Estate Tokenization & Trust Infrastructure (RWA)**

Monorepo Architecture · ERC-3643 Permissioned Suite · DvP T+0 Clearing · Smart Bridge ЕГКН

[![Foundry](https://img.shields.io/badge/Foundry-19%2F19%20passed-brightgreen.svg)](packages/contracts/test/MulkToken.t.sol)
[![Vitest](https://img.shields.io/badge/Vitest-15%2F15%20passed-brightgreen.svg)](packages/core-backend/test)
[![Coverage](https://img.shields.io/badge/Tests-34%2F34%20green-success.svg)](#5-тестовое-покрытие-и-статус-верификации-3434)
[![Standard](https://img.shields.io/badge/Standard-ERC--3643%20(T--REX)-blue.svg)](https://erc3643.org)
[![Jurisdiction](https://img.shields.io/badge/Jurisdiction-AIFC%20%2F%20AFSA%20(KZ)-orange.svg)](#8-регуляторное-соответствие-aifc--afsa-и-безопасность)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](packages/core-backend)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-lightgrey.svg)](packages/contracts)
[![Next.js](https://img.shields.io/badge/Next.js-14%20App%20Router-black.svg)](packages/web-app)
[![Sandbox](https://img.shields.io/badge/v1.0.0--PROD-AIFC%20Sandbox-8A2BE2.svg)](#)

Институциональный программный комплекс для токенизации коммерческой доходной недвижимости (**Real World Assets**) в юрисдикции **Международного финансового центра «Астана» (МФЦА / AIFC)**. Ончейн-состояние криптографически синхронизировано с государственным кадастром **ИС ЕГКН** через шину **Smart Bridge** (МИИЦР РК / НАО «Правительство для граждан»).

Ключевая инновация: устранение разрыва между токеном и физическим активом.

> Физический объект → регистрация залога в ЕГКН → машиночитаемая выписка → Gov-Oracle → `verifiedMint` ERC-3643 → Periodic Batch Auction → DvP T+0 (банк + EVM) → выплаты арендного дохода (NOI).

---

## Содержание

1. [Обзор платформы и ключевое назначение](#1-обзор-платформы-и-ключевое-назначение)
2. [Трёхуровневая системная архитектура](#2-трёхуровневая-системная-архитектура)
3. [Спецификация ключевых модулей](#3-спецификация-ключевых-модулей)
   - [3.1 Смарт-контракты ERC-3643 и мультисиг 3-of-5](#31-смарт-контракты-erc-3643-и-мультисиг-3-of-5)
   - [3.2 Gov-Oracle и Cadastre Bridge (ЕГКН)](#32-gov-oracle-и-cadastre-bridge-егкн)
   - [3.3 Periodic Batch Auction & Equilibrium Price](#33-periodic-batch-auction--equilibrium-price)
   - [3.4 DvP T+0 Saga Settlement Orchestrator](#34-dvp-t0-saga-settlement-orchestrator)
   - [3.5 Rental Yield & NOI Waterfall Engine](#35-rental-yield--noi-waterfall-engine)
   - [3.6 Fullstack Web-App Console](#36-fullstack-web-app-console)
4. [Структура монорепозитория](#4-структура-монорепозитория)
5. [Тестовое покрытие и статус верификации (34/34)](#5-тестовое-покрытие-и-статус-верификации-3434)
6. [Быстрый старт и локальный запуск](#6-быстрый-старт-и-локальный-запуск)
7. [Сквозной жизненный цикл актива (E2E)](#7-сквозной-жизненный-цикл-актива-e2e)
8. [Регуляторное соответствие (AIFC / AFSA) и безопасность](#8-регуляторное-соответствие-aifc--afsa-и-безопасность)
9. [CI/CD пайплайн и регламент Pull Request](#9-cicd-пайплайн-и-регламент-pull-request)
10. [Лицензирование и контакты](#10-лицензирование-и-контакты)

---

## 1. Обзор платформы и ключевое назначение

Mülk Chain закрывает четыре системных разрыва рынка токенизированной недвижимости:

| Вызов | Как решается |
|---|---|
| Двойные продажи | Эмиссия заблокирована без подтверждения обременения в ЕГКН (`verifiedMint` + `IGovOracle.verifyCadastreProof`) |
| Институциональный комплаенс | 100% переводов проходят `validateTransfer`: оба адреса `identityRegistry.isVerified == true` (OnchainID / ERC-3643) |
| Манипуляции стакана | Дискретный Periodic Batch Auction: коридор NAV ±10%, одна цена отсечения, без снайпинга |
| Риск контрагента | Синхронный DvP T+0: банк (KZT) и токен движутся только после блокировки обеих ног; сбой — компенсирующий rollback |

**Регуляторный и технологический базис**

- **Юрисдикция:** AIFC FinTech Lab / AFSA Investment Token Framework
- **Залог:** обеспечение в пользу Security Trustee по Закону РК «Об ипотеке недвижимого имущества»
- **Стандарт:** ERC-3643 (T-REX), белый список KYC
- **Ключи:** изолированный Gov-Oracle signer (HSM/KMS); enforcement — 3-of-5; agent-ключи не совмещаются с oracle signer

---

## 2. Трёхуровневая системная архитектура

Слои изолированы (clean architecture): клиент не ходит в EVM в обход шлюза, клиринг не минтит токены, оракул не входит в мультисиг enforcement.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  1. USER & CLIENT  ·  Next.js 14 App Router / Tailwind / wagmi           │
│  Investor Portal          Issuer Portal           Governance Board       │
│  · KYC Green Badge        · Asset registration    · 3-of-5 confirmations │
│  · GAV / NAV              · EGKN mint console     · forcedTransfer       │
│  · Limit ticket ±10%      · NOI trigger           · emergency pause      │
│  · NOI payout history     · Cadastre validation   · recovery / estate    │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ REST / OpenAPI 3 · EIP-712
┌────────────────────────────────▼─────────────────────────────────────────┐
│  2. CORE BACKEND & CLEARING  ·  TypeScript / PostgreSQL 16 / Redis 7     │
│  Identity Hub     Gov-Oracle        Batch Auction         DvP & Yield    │
│  · Sumsub HMAC    · Smart Bridge    · NAV collar ±10%     · Leg A KZT    │
│  · 3 claim topics · EIP-712 mint    · Equilibrium P*      · Leg B token  │
│  · FIFO registry  · Notarial 2-of-2 · Pro-rata + SHA-256  · NOI waterfall│
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ JSON-RPC · viem / ethers · Anvil
┌────────────────────────────────▼─────────────────────────────────────────┐
│  3. SMART CONTRACTS  ·  Solidity 0.8.24 / Foundry / OpenZeppelin         │
│  MulkToken            IdentityRegistry         GovOracle + Enforcement   │
│  · validateTransfer   · isVerified             · verifyCadastreProof     │
│  · verifiedMint       · investorOnchainID      · nonce / deadline        │
│  · recoveryAddress    · bindWallet             · 3-of-5 controller       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Спецификация ключевых модулей

### 3.1. Смарт-контракты ERC-3643 и мультисиг 3-of-5

Пакет [`packages/contracts`](packages/contracts). Компилятор **solc 0.8.24**, optimizer **200 runs**, прагма фиксирована: `pragma solidity 0.8.24`. В `foundry.toml` стоит `via_ir = false` (solc 0.8.24 + via-IR переполняет Yul-стек на этом контуре).

**`MulkToken`** — токен долей объекта. Обычный перевод идёт только через `validateTransfer`:

- отправитель и получатель `identityRegistry.isVerified == true`;
- полная заморозка (`frozen`) блокирует send/receive;
- частичная заморозка (`frozenTokens`) уменьшает available balance;
- `pause` останавливает обычные переводы и mint.

Обычный `mint` без кадастрового proof запрещён. Обход `validateTransfer` допускается только в явно маркированных recovery / enforcement путях.

```solidity
function verifiedMint(address to, uint256 amount, bytes calldata proof) external onlyAgent;
function recoveryAddress(address lostWallet, address newWallet, address investorOnchainID) external onlyAgent;
function forcedTransfer(address from, address to, uint256 amount) external onlyEnforcement returns (bool);
function setAddressFrozen(address account, bool isFrozen) external onlyAgent;
```

| Метод | Правило |
|---|---|
| `verifiedMint` | Единственный путь эмиссии. Proof: ABI `(cadastreHash, nonce, deadline, signature)`. Подпись EIP-712 `MintAuthorization` только от oracle signer. Nonce одноразовый, `deadline` не истёк, `IGovOracle.verifyCadastreProof` = true. |
| `recoveryAddress` | Оба кошелька привязаны к одному `investorOnchainID`, новый верифицирован. Утерянный замораживается, баланс переносится. |
| `forcedTransfer` | Только `EnforcementController` (`onlyEnforcement`). Прямой вызов с EOA офицера — нарушение. |
| `setAddressFrozen` | Agent freeze. Emergency `pause` / `unpause` — только через 3-of-5. |

**`IdentityRegistry`** — OnchainID: `registerIdentity`, `bindWallet`, `isVerified`, `investorOnchainID`.

**`GovOracle`** — ончейн-реестр обременений ЕГКН. `verifyCadastreProof` отклоняет нулевой хеш, pledge / arrest / revocation, просроченный proof и несовпадение кадастрового хеша.

**`EnforcementController`** — мультисиг **3-of-5**: Legal, Compliance, Security, Trustee, Operations. Один офицер — одна роль. Кворум обязателен для `forcedTransfer` и emergency pause.

### 3.2. Gov-Oracle и Cadastre Bridge (ЕГКН)

Пакет [`packages/oracle-service`](packages/oracle-service).

- **Data minimisation.** Ончейн уходит `cadastreHash = keccak256` канонического идентификатора ЕГКН, не ПДн арендаторов.
- **Anti-replay.** В EIP-712 дайджест входят `chainId`, адрес токена, `to`, `amount`, `cadastreHash`, одноразовый `nonce`, `deadline`.
- **Notarial Fallback SOP (2-of-2).** При недоступности Smart Bridge подпись оракула выпускается только после Legal + Compliance по одному `caseId`. Один офицер не подписывает за две роли.
- **Ключ оракула** хранится в HSM/KMS и не коммитится. Тестовые ключи (`makeAddrAndKey`, Anvil) допустимы только в `packages/contracts/test` и локальных симуляторах.

### 3.3. Periodic Batch Auction & Equilibrium Price

Пакет [`packages/core-backend/src/auction`](packages/core-backend/src/auction).

Дискретный call-аукцион вместо непрерывного стакана:

1. Сбор лимитных Buy/Sell в торговом окне.
2. **Price collar ±10% NAV.** Заявки вне `[0.9·NAV, 1.1·NAV]` отклоняются (Zod + движок) и не участвуют в клиринге.
3. **Equilibrium price P\*** — цена отсечения, максимизирующая исполняемый объём; при равенстве объёма выбирается минимальный дисбаланс, затем ближайшая к NAV.
4. Заявки строго лучше cutoff исполняются полностью; **pro-rata только на цене отсечения**.
5. Результат — неизменяемый `MatchedTradesBatch` с SHA-256 fingerprint.

### 3.4. DvP T+0 Saga Settlement Orchestrator

Пакет [`packages/core-backend/src/settlement`](packages/core-backend/src/settlement).

| Фаза | Действие |
|---|---|
| Hold & Validate | Leg A: холд KZT покупателя в банковском эскроу. Leg B: `isVerified` обеих сторон + hold токенов продавца |
| Atomic Execute | Одновременный release: токены → покупатель, KZT → продавец |
| Compensating Reversal | Сбой любой ноги → одна компенсация на ногу (lock reverse либо release reverse), без двойного unwind |

Терминальные статусы: `SETTLED`, `COMPENSATED`, `FAILED`. Отпускать одну ногу, пока вторая не заблокирована, нельзя.

### 3.5. Rental Yield & NOI Waterfall Engine

Пакет [`packages/core-backend/src/yield`](packages/core-backend/src/yield). Суммы везде `bigint` (тиын).

1. Snapshot балансов на record date / cutoff.
2. NOI = валовая аренда − opex.
3. Резерв SPV **5%** (500 bps).
4. WHT по инвестору.
5. Реестр выплат на IBAN / кошелёк, контроль dust.

\[
D_{\text{distributable}} = (\text{Gross NOI} - \text{Reserve}_{5\%}) \times (1 - \text{WHT}_{\text{investor}})
\]

### 3.6. Fullstack Web-App Console

Пакет [`packages/web-app`](packages/web-app) — Next.js 14 App Router, Tailwind, shadcn/ui, lucide-react, viem / wagmi. Светлая / тёмная тема.

| Консоль | Маршрут | Содержание |
|---|---|---|
| Investor | `/investor` | GAV, начисленный NOI (KZT), KYC Green Badge / Investor Class |
| Asset | `/investor/assets/BAITEREK-BC` | NAV, Stabilized NOI Yield 11.2%, адрес, кадастр, инспекция залога ЕГКН |
| Order terminal | `/investor/trade` | Лимитный Buy/Sell в текущий batch, визуализация коридора NAV ±10% |
| Payouts | `/investor/payouts` | Gross NOI → 5% SPV reserve → WHT 10% → Net Payout |
| Issuer | `/issuer` | Регистрация объекта (валидация кадастра), Verified Mint, NOI trigger, 3-of-5 board |

Типизированный клиент соответствует OpenAPI шлюза (`/api/v1/investor/*`, `/issuer/*`, `/auction/*`). Без `CORE_BACKEND_URL` BFF отдаёт демо-данные по тому же контракту; при заданном URL проксирует на Hono.

---

## 4. Структура монорепозитория

```
mulk-chain/
├── .cursorrules                 # Рамки ERC-3643, DvP, ЕГКН, изоляция ключей
├── foundry.toml                 # solc 0.8.24, optimizer 200, via_ir = false
├── docker-compose.yml           # PostgreSQL 16 + Redis 7
├── start-demo.ps1               # Один процесс: infra → Anvil → deploy → API + UI
├── package.json                 # npm workspaces
├── .github/workflows/ci.yml     # Foundry + Vitest + web typecheck
└── packages/
    ├── contracts/               # Solidity 0.8.24 / Foundry
    │   ├── src/
    │   │   ├── interfaces/      # IIdentityRegistry, IGovOracle, IMulkEnforcementTarget
    │   │   ├── token/           # MulkToken.sol (ERC-3643)
    │   │   ├── identity/        # IdentityRegistry.sol
    │   │   ├── oracle/          # GovOracle.sol
    │   │   └── governance/      # EnforcementController.sol (3-of-5)
    │   ├── script/              # DeployMulkChain.s.sol
    │   └── test/                # MulkToken.t.sol — 19 Foundry
    ├── oracle-service/          # Smart Bridge / ЕГКН, EIP-712 mint, Notarial Fallback
    ├── core-backend/            # Клиринг, DvP, NOI, Identity Hub, REST Gateway
    │   └── src/
    │       ├── auction/         # Periodic Batch Auction
    │       ├── settlement/      # DvP T+0 saga
    │       ├── yield/           # NOI waterfall
    │       ├── identity/        # KYC HMAC, claims, FIFO registry sync
    │       └── api/             # /investor, /issuer, /auction, /docs
    └── web-app/                 # Next.js 14 investor / issuer consoles
```

---

## 5. Тестовое покрытие и статус верификации (34/34)

Контур платформы: **19 Foundry + 15 Vitest = 34/34**. Отдельно: **4** теста `oracle-service` (EIP-712 mint, обременение, Notarial Fallback).

| Модуль | Фреймворк | Инварианты | Результат |
|---|---|---|---|
| Смарт-контракты ERC-3643 `MulkToken.t.sol` | Foundry / Forge | KYC-гейт `validateTransfer`; `verifiedMint` только с подписью оракула и хешем ЕГКН; replay nonce; `recoveryAddress`; `forcedTransfer` только 3-of-5; pause | **19 / 19** |
| Periodic Batch Auction `batch-auction.spec.ts` | Vitest (`bigint`) | Collar NAV ±10%; equilibrium P\*; pro-rata на cutoff; SHA-256 fingerprint | **5 / 5** |
| DvP Saga `dvp-orchestrator.spec.ts` | Vitest (`bigint`) | Атомарный settle; rollback банка; блок без `isVerified`; нет двойной компенсации | **4 / 4** |
| Rental Yield `rental-yield.spec.ts` | Vitest (`bigint`) | Snapshot; резерв SPV 5%; WHT; dust / largest remainder | **2 / 2** |
| Identity & Claims `identity-flow.spec.ts` | Vitest | HMAC-SHA256; EIP-712 claims (`KYC_VALID`, `INVESTOR_CLASS`, `SANCTIONS_CLEAR`); FIFO IdentityRegistry | **2 / 2** |
| API Gateway `api-gateway.spec.ts` | Vitest | Регистрация актива, лимитный ордер, клиринг, NOI | **1 / 1** |
| E2E Full-Loop `e2e-full-loop.spec.ts` | Vitest | Пилот Baiterek: ЕГКН → mint 10 000 MULK → Alice/Bob → клиринг → DvP → NOI | **1 / 1** |

```bash
forge test -vvv                 # 19
npm run test:backend            # 15
npm run test:oracle             # 4
npm run typecheck:web
```

---

## 6. Быстрый старт и локальный запуск

**Требования:** Node.js ≥ 20, npm, [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`, `anvil`), Docker Desktop.

```bash
git clone https://github.com/amanbayev/mulk-chain.git
cd mulk-chain
npm install
npm run bootstrap          # OpenZeppelin v5.2 + forge-std
```

### Windows — одна команда

Поднимает Anvil, деплой, API Gateway и веб-консоль, затем открывает браузер. Docker Desktop **не обязателен**: без него шлюз работает in-memory (Postgres/Redis нужны только для постоянного FIFO).

Если PowerShell пишет, что выполнение сценариев отключено (`npm.ps1` / `UnauthorizedAccess`), не вызывайте `npm` напрямую — используйте `.cmd`:

```bat
.\demo.cmd
```

Либо один раз разрешите скрипты для текущего пользователя (стандартный фикс Node.js на Windows):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
npm.cmd run demo
```

Консоль: http://localhost:3000 · OpenAPI: http://127.0.0.1:8787/api/v1/docs

### По шагам

```bash
# Терминал 1 — PostgreSQL 16 + Redis 7
npm run infra:up

# Терминал 2 — Anvil (http://127.0.0.1:8545, chainId 31337)
npm run anvil

# Терминал 3 — компиляция, деплой ERC-3643, экспорт addresses → contracts.json
npm run deploy:local

# Терминал 4 — API + UI
npm run dev:backend        # :8787
npm run dev:web            # :3000
```

### Тесты и сборка

```bash
forge test -vvv
npm run test:e2e
npm run test:backend
npm run test:oracle
npm run compile:contracts          # solc 0.8.24 без Foundry
npm run build -w @mulk-chain/core-backend
npm run build -w @mulk-chain/oracle-service
```

### Переменные окружения

Скопируйте `.env.example`. Ключ Gov-Oracle — в HSM/KMS, **не коммитится**. Пять ключей Enforcement принадлежат разным должностным лицам (порог 3-of-5). Agent-ключи токена не совмещаются с oracle signer.

Шаблон для Vercel: [`packages/web-app/.env.production.example`](packages/web-app/.env.production.example). В клиентский бандл попадают только `NEXT_PUBLIC_*`. Приватные ключи и Alchemy-секреты туда не ставятся.

### Публичный деплой на Vercel (Arbitrum Sepolia)

Консоль живёт в workspace `@mulk-chain/web-app` и не импортирует `packages/core-backend`. Корневой [`vercel.json`](vercel.json) ставит `installCommand` / `buildCommand` из корня монорепо. **Root Directory** в дашборде оставьте `.` (корень). Поле `outputDirectory` не задаётся: Vercel сам забирает Next.js Build Output API; указание `packages/web-app/.next` ломает деплой.

**Dashboard**

1. [vercel.com/new](https://vercel.com/new) → Import Git Repository → этот репозиторий.
2. Framework Preset: Next.js. Root Directory: пусто / `.`.
3. Build & Development Settings можно не трогать — их перекрывает `vercel.json`.
4. Environment Variables → Production (и Preview при необходимости) — значения из `.env.production.example`.
5. Deploy.

**CLI**

```bash
npm i -g vercel
cd /path/to/mulk-chain
vercel login
vercel          # preview
vercel --prod   # production
```

CLI подхватит корневой `vercel.json`. Env можно залить так:

```bash
vercel env add NEXT_PUBLIC_CHAIN_ID production
```

Переменные для Production:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | `421614` |
| `NEXT_PUBLIC_RPC_URL` | `https://sepolia-rollup.arbitrum.io/rpc` |
| `NEXT_PUBLIC_MULK_TOKEN_ADDRESS` | `0x6e6d979a8cBC79d3cbc641403aD25C6234E97c83` |
| `NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS` | `0x0e9104384A82B6AA71BE351d2ECEc7B2C94e4254` |
| `NEXT_PUBLIC_GOV_ORACLE_ADDRESS` | `0x6d1331fc9Cdb92838D619557A881d0DeE57Db2d6` |
| `NEXT_PUBLIC_ENFORCEMENT_CONTROLLER_ADDRESS` | `0x4ac035249b770E911D48fc30402f06984870Efd1` |
| `NEXT_PUBLIC_EXPLORER_URL` | `https://sepolia.arbiscan.io` |
| `ARBITRUM_SEPOLIA_RPC_URL` | `https://sepolia-rollup.arbitrum.io/rpc` |

`ARBITRUM_SEPOLIA_RPC_URL` — server-only для `/api/rpc`. Кошелёк без сети 421614 получит `wallet_switchEthereumChain` / `wallet_addEthereumChain`.

### REST API Gateway

| Метод | Путь |
|---|---|
| `POST` | `/api/v1/investor/kyc/init` |
| `GET` | `/api/v1/investor/portfolio` |
| `POST` | `/api/v1/investor/orders` |
| `GET` | `/api/v1/investor/yield/history` |
| `POST` | `/api/v1/issuer/assets` |
| `POST` | `/api/v1/issuer/mint/request` |
| `POST` | `/api/v1/issuer/yield/trigger` |
| `GET` | `/api/v1/auction/status` |
| `POST` | `/api/v1/auction/clear` (`x-admin-key`) |
| `POST` | `/api/v1/webhooks/kyc/:provider` (HMAC-SHA256) |
| `GET` | `/api/v1/openapi.json` · `/api/v1/docs` |

Ордера принимаются только после GREEN KYC. DTO валидируются Zod.

---

## 7. Сквозной жизненный цикл актива (E2E)

Сценарий [`packages/core-backend/test/e2e-full-loop.spec.ts`](packages/core-backend/test/e2e-full-loop.spec.ts) — пилот **Baiterek Business Center**, кадастр `KZ-AST-2026-TOWER-01`.

| # | Шаг | Результат |
|---|---|---|
| 1 | `POST /api/v1/issuer/assets` | Объект зарегистрирован. NAV 50 000 KZT / токен, лимит 10 000 MULK |
| 2 | Gov-Oracle + `verifiedMint` | 10 000 MULK эмитенту при валидном кадастровом proof |
| 3 | KYC Alice & Bob | Sumsub GREEN → Professional → FIFO `IdentityRegistry` |
| 4 | Лимитные заявки | Sell 100 @ 50 000 KZT (эмитент), Buy 100 @ 50 000 KZT (Bob) |
| 5 | Клиринг batch | P\* = 50 000 KZT, объём 100, SHA-256 fingerprint батча |
| 6 | DvP T+0 | Холд 5 000 000 KZT на эскроу Bob → 100 MULK Bob, эмитент 9 900 MULK |
| 7 | NOI 1 000 000 KZT | Snapshot: Bob 1%, эмитент 99% |
| 8 | Водопад | Резерв 5% (50 000) → Bob net **8 550** (WHT 10%) → эмитент **940 500** на IBAN |

```bash
npm run test:e2e
```

---

## 8. Регуляторное соответствие (AIFC / AFSA) и безопасность

- **AIFC Investment Token Framework.** Титул на объект — у SPV в МФЦА; токены квалифицируются как property-backed investment tokens.
- **Ипотека РК.** Объект обременяется в пользу лицензированного Security Trustee в соответствии с Законом РК «Об ипотеке недвижимого имущества».
- **AML/CFT.** Нет анонимного владения и P2P вне `IdentityRegistry`. Claims: KYC valid, investor class, sanctions clear.
- **Права инвестора.** Утеря ключа / наследование — `recoveryAddress` при том же OnchainID; судебное взыскание — только 3-of-5 `forcedTransfer`.
- **Комплаенс-инварианты** (полный список — [`.cursorrules`](.cursorrules)): нет скрытого admin-mint; mint без proof ЕГКН невозможен; DvP не отпускает одну ногу без второй; Notarial Fallback — Legal + Compliance по одному `caseId`.

---

## 9. CI/CD пайплайн и регламент Pull Request

Пайплайн: [`.github/workflows/ci.yml`](.github/workflows/ci.yml). На каждый `push` / `pull_request`:

| Job | Команда |
|---|---|
| Foundry | `forge test -vvv` |
| Vitest | `npm run test:backend` |
| Web app | `npm run typecheck:web` |

Слияние в защищённую основную ветку — только после зелёного CI. Не коммитить `.env`, keystore, mnemonic, oracle / enforcement ключи.

---

## 10. Лицензирование и контакты

Пилотный контур репозитория помечен как `UNLICENSED` в `package.json` (закрытый sandbox). Целевой публичный режим документации платформы — **MIT License**, в соответствии с требованиями AFSA и контуром цифровизации РК.

© 2026 Mülk Chain. AIFC / AFSA Sandbox · ERC-3643 · Smart Bridge ЕГКН.

Не является офертой ценных бумаг. Доступ к консоли — для уполномоченных участников пилота.
