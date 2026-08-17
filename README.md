# Mülk Chain

[![Foundry Tests](https://img.shields.io/badge/Foundry-19%20passed-brightgreen.svg)](packages/contracts)
[![Vitest Tests](https://img.shields.io/badge/Vitest-11%20passed-brightgreen.svg)](packages/core-backend)
[![ERC Standard](https://img.shields.io/badge/Standard-ERC--3643%20(T--REX)-blue.svg)](https://erc3643.org)
[![Jurisdiction](https://img.shields.io/badge/Jurisdiction-AIFC%20%2F%20Kazakhstan-orange.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](packages/core-backend)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-lightgrey.svg)](packages/contracts)

Инфраструктура токенизации коммерческой недвижимости (RWA) в юрисдикции **МФЦА (AIFC, Казахстан)**. Ончейн-состояние синхронизируется с государственным кадастром **ЕГКН** через Gov-Oracle / Smart Bridge.

Монорепозиторий: смарт-контракты ERC-3643 / T-REX, шлюз кадастрового оракула, клиринг Periodic Batch Auction, расчёты DvP T+0, Identity & Compliance Hub и REST API Gateway.

---

## Архитектура

```
┌─────────────┐     HMAC      ┌──────────────────────────┐     EIP-712 claims
│ Sumsub /    │──────────────▶│ Identity & Compliance Hub │──────────────────┐
│ eGov / DID  │               └──────────────────────────┘                  │
└─────────────┘                          │                                  ▼
                                         │                    ┌─────────────────────────┐
┌─────────────┐  REST / OpenAPI          ▼                    │ IdentityRegistry.sol    │
│ Investor UI │────────────────▶ API Gateway (Hono) ─────────▶│ MulkToken (ERC-3643)    │
│ Issuer UI   │                          │                    │ EnforcementController   │
└─────────────┘                          │                    │ GovOracle               │
                                         ▼                    └──────────▲──────────────┘
                          ┌──────────────────────────┐                   │
                          │ Periodic Batch Auction   │                   │
                          │ DvP T+0 saga orchestrator│                   │
                          │ Rental yield (NOI)       │                   │
                          └──────────────────────────┘                   │
                                                                         │
┌─────────────┐  cadastre proof (EIP-712)  ┌─────────────────┐           │
│ ЕГКН /      │◀──────────────────────────▶│ Gov-Oracle      │───────────┘
│ Smart Bridge│                            │ cadastre.service│
└─────────────┘                            └─────────────────┘
```

### Пакеты

| Пакет | Назначение |
|---|---|
| `packages/contracts` | Solidity 0.8.24: `MulkToken`, `IdentityRegistry`, `GovOracle`, `EnforcementController` |
| `packages/oracle-service` | Шлюз Smart Bridge / ЕГКН, EIP-712 `verifiedMint`, Notarial Fallback SOP |
| `packages/core-backend` | Аукцион, DvP T+0, дивиденды NOI, KYC/claims, REST API Gateway |
| `packages/web-app` | Next.js 14 App Router: кабинеты инвестора и эмитента (Tailwind, shadcn/ui, wagmi) |

### Потоки

1. **Онбординг.** Инвестор проходит KYC (Sumsub / eGov Mobile / DID). Вебхук с HMAC-SHA256 классифицирует инвестора (Retail / Professional / Institutional / Accredited) и выпускает OnchainID claims. Воркер вызывает `IdentityRegistry.registerIdentity` и `setClaim`.
2. **Эмиссия.** Issuer регистрирует объект (кадастровый номер, SPV, NAV). `verifiedMint` возможен только с подписью изолированного ключа Gov-Oracle и живым кадастровым proof.
3. **Вторичный рынок.** Лимитные заявки собираются в дискретном окне Periodic Batch Auction (коридор NAV ±10%). Клиринг — одна цена отсечения, pro-rata на cutoff.
4. **Расчёты.** Каждая matched-сделка идёт в saga DvP T+0: lock KZT в банковском эскроу → `isVerified` + hold токенов → одновременный release. Сбой ноги — компенсирующий rollback.
5. **Доход.** На дату отсечки фиксируются балансы, из NOI вычитается резерв SPV (5%) и WHT, формируется реестр выплат.

---

## Смарт-контракты ERC-3643 / T-REX

Компилятор: **solc 0.8.24**, optimizer **200 runs**. Прагма фиксированная: `pragma solidity 0.8.24`.

### `MulkToken`

Токен долей объекта. Переводы идут только через `validateTransfer`:

- оба адреса `identityRegistry.isVerified == true` (OnchainID + KYC/AML);
- полная заморозка (`frozen`) блокирует send/receive;
- частичная заморозка (`frozenTokens`) уменьшает available balance;
- пауза останавливает обычные переводы.

Ключевые методы:

| Метод | Правило |
|---|---|
| `verifiedMint(to, amount, proof)` | Единственный путь эмиссии. Proof: ABI `(cadastreHash, nonce, deadline, signature)`. Подпись EIP-712 `MintAuthorization` только от oracle signer. Nonce одноразовый, `deadline` не истёк, `IGovOracle.verifyCadastreProof` = true. |
| `recoveryAddress(lost, new, onchainID)` | Оба кошелька привязаны к одному OnchainID, новый верифицирован. Утерянный замораживается, баланс переносится. |
| `forcedTransfer(from, to, amount)` | Только `EnforcementController` (`onlyEnforcement`). Судебное/enforcement движение, в том числе с замороженного адреса. |

Обычный `mint` без кадастрового доказательства запрещён. Обход `validateTransfer` допускается только в явно маркированных recovery/enforcement путях.

### `IdentityRegistry`

Минимальный OnchainID-реестр: `registerIdentity`, `bindWallet`, `isVerified`, `investorOnchainID`.

### `GovOracle`

Ончейн-реестр обременений ЕГКН. `verifyCadastreProof` отклоняет нулевой хеш, pledge/arrest/revocation, просроченный proof и несовпадение кадастрового хеша.

### `EnforcementController`

Мультисиг **3-of-5**: Legal, Compliance, Security, Trustee, Operations. Управляет `forcedTransfer`, emergency `pause` / `unpause`. Один офицер — одна роль. Прямой вызов `forcedTransfer` с EOA офицера запрещён.

---

## Periodic Batch Auction

Дискретный call-аукцион для неликвидных RWA-лотов (`packages/core-backend/src/auction/`).

1. Сбор лимитных Buy/Sell в торговом интервале.
2. **Price collar ±10% NAV.** Заявки вне `[0.9·NAV, 1.1·NAV]` отклоняются и не участвуют в клиринге.
3. **Equilibrium price** — цена отсечения, максимизирующая исполняемый объём; при равенстве объёма выбирается минимальный дисбаланс спроса/предложения, затем ближайшая к NAV.
4. Заявки строго лучше cutoff исполняются полностью; **pro-rata только на цене отсечения**.
5. Результат — неизменяемый `MatchedTradesBatch` с SHA-256 fingerprint.

---

## DvP T+0

Оркестратор `DvpOrchestratorService` реализует компенсирующую saga:

| Фаза | Действие |
|---|---|
| Leg A | Блокировка KZT покупателя в банковском эскроу |
| Leg B | `isVerified` обеих сторон + hold токенов продавца в MulkToken |
| Execution | Одновременный release: токены → покупатель, KZT → продавец |
| Rollback | Одна компенсация на ногу (lock reverse либо release reverse, без двойного unwind) |

Терминальные статусы: `SETTLED`, `COMPENSATED`, `FAILED`. Отпускать одну ногу, пока вторая не заблокирована, нельзя.

---

## Арендный доход (NOI)

`RentalYieldService`: snapshot балансов на record date → NOI = валовая аренда − opex → резерв SPV **5%** → WHT по инвестору → реестр выплат на IBAN/кошелёк. Суммы везде `bigint`.

---

## Статус тестов

| Набор | Инструмент | Тесты | Фокус |
|---|---|---|---|
| `packages/contracts/test/MulkToken.t.sol` | Foundry / Forge | **19** | `verifiedMint`, KYC-гейты, `recoveryAddress`, 3-of-5 `forcedTransfer`, pause |
| `packages/core-backend/test/{batch-auction,dvp-orchestrator,rental-yield}.spec.ts` | Vitest | **11** | коридор и equilibrium, атомарный DvP и rollback банка, математика NOI |
| `packages/core-backend/test/{identity-flow,api-gateway}.spec.ts` | Vitest | 3 | KYC webhook → claims → registry; REST Gateway |
| `packages/oracle-service` | Node test runner | 4 | EIP-712 mint proof, обременение, Notarial Fallback |

Контрактный контур: **19 Foundry**. Расчётный контур спринта 3: **11 Vitest**. Полный прогон `core-backend` после Identity Hub / API Gateway: **14 Vitest**.

---

## Запуск

Требования: **Node.js ≥ 20**, **Git**, [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `solc 0.8.24`).

```bash
git clone https://github.com/amanbayev/mulk-chain.git
cd mulk-chain
npm install
npm run bootstrap          # OpenZeppelin v5.2 + forge-std
```

### Контракты

```bash
npm run compile:contracts  # solc 0.8.24 (без Foundry)
forge build
forge test -vvv            # 19 тестов MulkToken
npm run test:contracts
```

### Backend и оракул

```bash
npm run test:backend       # Vitest (аукцион, DvP, yield, identity, API)
npm run test:oracle        # Gov-Oracle / Notarial Fallback
npm test                   # все workspace-скрипты test
```

Сборка TypeScript:

```bash
npm run build -w @mulk-chain/core-backend
npm run build -w @mulk-chain/oracle-service
```

OpenAPI шлюза: `GET /api/v1/openapi.json`, UI — `GET /api/v1/docs` (после монтирования `createApiGateway`).

### Веб-консоль

```bash
npm run dev:web            # http://127.0.0.1:3000
```

`/investor` — портфель, Baiterek Business Center, лимитный терминал (коридор NAV ±10%), история NOI.
`/issuer` — регистрация объекта, verified mint, начисление NOI, мультисиг 3-of-5.
Тема светлая/тёмная. Без `CORE_BACKEND_URL` BFF отдаёт демо-данные по контракту OpenAPI; при заданном URL проксирует на `packages/core-backend`.

### Переменные окружения

Скопируйте `.env.example`. Ключ Gov-Oracle хранится в HSM/KMS и **не коммитится**. Пять ключей Enforcement принадлежат разным должностным лицам (порог 3-of-5). Agent-ключи токена не совмещаются с oracle signer.

---

## API Gateway (кратко)

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

Ордера принимаются только после GREEN KYC. DTO валидируются Zod.

---

## Правила комплаенса (кратко)

Полный список — в `.cursorrules`.

- Переводы только через `validateTransfer`; скрытый admin-mint запрещён.
- `forcedTransfer` — исключительно 3-of-5 EnforcementController.
- Mint без кадастрового proof ЕГКН невозможен.
- DvP: нет движения токена без cash lock и наоборот; компенсация обязательна.
- Notarial Fallback: подпись оракула при недоступности Smart Bridge — только после Legal + Compliance по одному `caseId`.
