// RateXray - App JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // State management
    const state = {
        mode: 'audit', // 'audit' or 'plan'
        history: [],
        rates: {
            usdCny: 7.25,
            usdInr: 83.50,
            usdGbp: 0.79,
            usdTry: 32.50
        },
        customCard: {
            withdraw: 1.0,
            deposit: 1.0,
            fx: 2.0
        }
    };

    // UI elements selectors
    const tabAudit = document.getElementById('tab-audit');
    const tabPlan = document.getElementById('tab-plan');
    const auditFormContainer = document.getElementById('audit-form-container');
    const planFormContainer = document.getElementById('plan-form-container');
    const auditForm = document.getElementById('audit-form');
    const planForm = document.getElementById('plan-form');
    
    // Live reference rates indicators
    const refUsdCny = document.getElementById('ref-usd-cny');
    const refUsdInr = document.getElementById('ref-usd-inr');
    
    // Node values in pipeline flow
    const flowValCny = document.getElementById('flow-val-cny');
    const flowValOkx = document.getElementById('flow-val-okx');
    const flowValCard = document.getElementById('flow-val-card');
    const flowValAi = document.getElementById('flow-val-ai');
    
    // Node fees inside pipeline flow
    const flowFeeOkx = document.getElementById('flow-fee-okx');
    const flowFeeWithdraw = document.getElementById('flow-fee-withdraw');
    const flowFeeFx = document.getElementById('flow-fee-fx');
    
    // Output fields
    const activeModeLabel = document.getElementById('active-mode-label');
    const resTotalCny = document.getElementById('res-total-cny');
    const resTotalCnyDesc = document.getElementById('res-total-cny-desc');
    const resCnyPerSeat = document.getElementById('res-cny-per-seat');
    const resCnyPerSeatDesc = document.getElementById('res-cny-per-seat-desc');
    const resLeakRate = document.getElementById('res-leak-rate');
    const resLeakBar = document.getElementById('res-leak-bar');
    const resLeakDesc = document.getElementById('res-leak-desc');
    const resRealRate = document.getElementById('res-real-rate');
    const resRealRateDesc = document.getElementById('res-real-rate-desc');
    
    // Breakdown fields
    const breakdownBar = document.getElementById('breakdown-bar');
    const breakdownValService = document.getElementById('breakdown-val-service');
    const breakdownValOkx = document.getElementById('breakdown-val-okx');
    const breakdownValWithdraw = document.getElementById('breakdown-val-withdraw');
    const breakdownValDeposit = document.getElementById('breakdown-val-deposit');
    const breakdownValFx = document.getElementById('breakdown-val-fx');
    
    // Suggestions
    const proposalsContainer = document.getElementById('proposals-container');
    
    // History
    const historyRows = document.getElementById('history-rows');
    const btnClearHistory = document.getElementById('btn-clear-history');
    
    // Input step summaries
    const auditOkxRate = document.getElementById('audit-okx-rate');
    const auditDepositLoss = document.getElementById('audit-deposit-loss');
    const auditCardFxRate = document.getElementById('audit-card-fx-rate');
    
    // New selectors for optimizations
    const auditCurrencySelect = document.getElementById('audit-currency');
    const labelAuditInrCharged = document.getElementById('label-audit-inr-charged');
    const auditFxUnit = document.getElementById('audit-fx-unit');
    
    // Planner step elements
    const planCurrencySelect = document.getElementById('plan-currency');
    const labelPlanUsdTarget = document.getElementById('label-plan-usd-target');
    const planUsdTargetInput = document.getElementById('plan-usd-target');
    const planUsdTargetWrapper = document.getElementById('plan-usd-target-wrapper');

    // Initialize application
    init();

    function init() {
        loadCustomCard();
        loadHistory();
        fetchExchangeRates();
        setupEventListeners();
        
        // Initial run for both modes to pre-render calculations
        updateAuditIntermediates();
        runAuditCalculation();
        runPlanCalculation();
    }

    function loadCustomCard() {
        try {
            const saved = localStorage.getItem('ratexray_custom_card');
            if (saved) {
                state.customCard = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading custom card', e);
        }
    }

    // Fetch live currency rates (completely free open rate API, no key needed)
    async function fetchExchangeRates() {
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/USD');
            if (!res.ok) throw new Error('API request failed');
            const data = await res.json();
            
            if (data && data.rates) {
                state.rates.usdCny = data.rates.CNY || 7.25;
                state.rates.usdInr = data.rates.INR || 83.50;
                state.rates.usdGbp = data.rates.GBP || 0.79;
                state.rates.usdTry = data.rates.TRY || 32.50;
                
                // Update header values
                refUsdCny.textContent = state.rates.usdCny.toFixed(2);
                refUsdInr.textContent = state.rates.usdInr.toFixed(2);
                
                // Update Planner inputs with latest rates (Only update placeholders, DO NOT set values to respect "zero default values on load" constraint)
                document.getElementById('plan-usd-cny').placeholder = `例如：${state.rates.usdCny.toFixed(2)}`;
                document.getElementById('plan-usd-target').placeholder = `例如：${state.rates.usdInr.toFixed(2)}`;
                document.getElementById('plan-okx-cny').placeholder = `例如：${state.rates.usdCny.toFixed(2)}`;
                
                showToast('已同步最新国际官方参考汇率');
                
                // If in planner mode, recalculate
                if (state.mode === 'plan') {
                    runPlanCalculation();
                } else {
                    updateAuditIntermediates();
                    runAuditCalculation();
                }
            }
        } catch (err) {
            console.warn('Unable to fetch live rates, using fallbacks.', err);
            refUsdCny.textContent = state.rates.usdCny.toFixed(2);
            refUsdInr.textContent = state.rates.usdInr.toFixed(2);
        }
    }

    function setupCardPresets(prefix) {
        const container = prefix === 'audit' ? document.getElementById('audit-card-presets') : document.querySelector('#plan-form-container .card-presets');
        if (!container) return;

        const btns = container.querySelectorAll('.preset-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const withdraw = parseFloat(btn.dataset.withdraw);
                const deposit = parseFloat(btn.dataset.deposit);
                const fx = parseFloat(btn.dataset.fx);
                const tx = parseFloat(btn.dataset.tx) || 0;
                const flat = parseFloat(btn.dataset.flat) || 0;

                document.getElementById(`${prefix}-withdraw-fee`).value = withdraw;
                document.getElementById(`${prefix}-deposit-rate`).value = deposit;
                document.getElementById(`${prefix}-fx-fee`).value = fx;

                const txInput = document.getElementById(`${prefix}-tx-fee-spending`);
                if (txInput) {
                    if (prefix === 'plan') {
                        txInput.value = tx;
                    } else {
                        // For audit mode, the tx fee is absolute USD. Keep it empty to let users enter from bills.
                        txInput.value = '';
                    }
                }

                const flatInput = document.getElementById(`${prefix}-deposit-flat`);
                if (flatInput) {
                    flatInput.value = flat;
                }

                if (btn.textContent.includes('自定义')) {
                    document.getElementById(`${prefix}-withdraw-fee`).value = state.customCard.withdraw;
                    document.getElementById(`${prefix}-deposit-rate`).value = state.customCard.deposit;
                    document.getElementById(`${prefix}-fx-fee`).value = state.customCard.fx;
                    if (flatInput) {
                        flatInput.value = state.customCard.flat || 0;
                    }
                    if (txInput && prefix === 'plan') {
                        txInput.value = '';
                    }
                }

                if (prefix === 'audit') {
                    updateAuditIntermediates();
                    runAuditCalculation();
                } else {
                    runPlanCalculation();
                }
            });
        });
    }

    function handleCardInputChange(prefix) {
        const container = prefix === 'audit' ? document.getElementById('audit-card-presets') : document.querySelector('#plan-form-container .card-presets');
        if (!container) return;

        const customBtn = Array.from(container.querySelectorAll('.preset-btn')).find(b => b.textContent.includes('自定义'));
        if (customBtn && customBtn.classList.contains('active')) {
            state.customCard.withdraw = parseFloat(document.getElementById(`${prefix}-withdraw-fee`).value) || 0;
            state.customCard.deposit = parseFloat(document.getElementById(`${prefix}-deposit-rate`).value) || 0;
            state.customCard.fx = parseFloat(document.getElementById(`${prefix}-fx-fee`).value) || 0;
            const flatInput = document.getElementById(`${prefix}-deposit-flat`);
            if (flatInput) {
                state.customCard.flat = parseFloat(flatInput.value) || 0;
            }
            localStorage.setItem('ratexray_custom_card', JSON.stringify(state.customCard));
        }
    }

    function setupEventListeners() {
        // Tab switching (Left Calculator)
        tabAudit.addEventListener('click', () => switchMode('audit'));
        tabPlan.addEventListener('click', () => switchMode('plan'));

        // Right Dashboard Tab Switching
        const tabXray = document.getElementById('tab-xray');
        const tabProposals = document.getElementById('tab-proposals');
        const tabHistory = document.getElementById('tab-history');

        const contentXray = document.getElementById('content-xray');
        const contentProposals = document.getElementById('content-proposals');
        const contentHistory = document.getElementById('content-history');

        function switchDashboardTab(activeTab) {
            if (tabXray) tabXray.classList.remove('active');
            if (tabProposals) tabProposals.classList.remove('active');
            if (tabHistory) tabHistory.classList.remove('active');

            if (contentXray) contentXray.classList.add('hidden');
            if (contentProposals) contentProposals.classList.add('hidden');
            if (contentHistory) contentHistory.classList.add('hidden');

            if (activeTab === 'xray' && tabXray && contentXray) {
                tabXray.classList.add('active');
                contentXray.classList.remove('hidden');
            } else if (activeTab === 'proposals' && tabProposals && contentProposals) {
                tabProposals.classList.add('active');
                contentProposals.classList.remove('hidden');
            } else if (activeTab === 'history' && tabHistory && contentHistory) {
                tabHistory.classList.add('active');
                contentHistory.classList.remove('hidden');
            }
        }

        if (tabXray) tabXray.addEventListener('click', () => switchDashboardTab('xray'));
        if (tabProposals) tabProposals.addEventListener('click', () => switchDashboardTab('proposals'));
        if (tabHistory) tabHistory.addEventListener('click', () => switchDashboardTab('history'));

        // Set up card presets for both forms
        setupCardPresets('audit');
        setupCardPresets('plan');

        // Note: Smart estimate toggle listener has been removed

        // Audit currency switcher
        auditCurrencySelect.addEventListener('change', () => {
            const currency = auditCurrencySelect.value;
            const inrChargedInput = document.getElementById('audit-inr-charged');

            labelAuditInrCharged.textContent = `AI 官网账单金额 (${currency})`;
            auditFxUnit.textContent = `USD/${currency}`;

            if (currency === 'USD') {
                inrChargedInput.placeholder = '例如：30';
            } else if (currency === 'INR') {
                inrChargedInput.placeholder = '例如：2400';
            } else if (currency === 'GBP') {
                inrChargedInput.placeholder = '例如：26';
            } else if (currency === 'TRY') {
                inrChargedInput.placeholder = '例如：900';
            }

            updateAuditIntermediates();
            runAuditCalculation();
        });

        // Plan target currency change handler
        planCurrencySelect.addEventListener('change', () => {
            const currency = planCurrencySelect.value;
            const priceInput = document.getElementById('plan-price');
            
            if (currency === 'USD') {
                priceInput.placeholder = '例如：30';
                planUsdTargetWrapper.classList.add('hidden');
            } else if (currency === 'INR') {
                priceInput.placeholder = '例如：2400';
                labelPlanUsdTarget.textContent = '官方汇率 (USD/INR)';
                planUsdTargetInput.placeholder = `例如：${state.rates.usdInr.toFixed(2)}`;
                planUsdTargetWrapper.classList.remove('hidden');
            } else if (currency === 'GBP') {
                priceInput.placeholder = '例如：26';
                labelPlanUsdTarget.textContent = '官方汇率 (USD/GBP)';
                planUsdTargetInput.placeholder = `例如：${state.rates.usdGbp.toFixed(4)}`;
                planUsdTargetWrapper.classList.remove('hidden');
            } else if (currency === 'TRY') {
                priceInput.placeholder = '例如：900';
                labelPlanUsdTarget.textContent = '官方汇率 (USD/TRY)';
                planUsdTargetInput.placeholder = `例如：${state.rates.usdTry.toFixed(2)}`;
                planUsdTargetWrapper.classList.remove('hidden');
            }
            
            runPlanCalculation();
        });

        // Real-time calculation triggers in Audit form
        const auditInputs = ['audit-cny-paid', 'audit-usdt-got', 'audit-withdraw-fee', 'audit-deposit-rate', 'audit-deposit-flat', 'audit-fx-fee', 'audit-inr-charged', 'audit-usd-deducted', 'audit-seats', 'audit-tx-fee-spending', 'audit-cross-border-fee-spending'];
        auditInputs.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                if (['audit-withdraw-fee', 'audit-deposit-rate', 'audit-fx-fee'].includes(id)) {
                    handleCardInputChange('audit');
                }
                updateAuditIntermediates();
                runAuditCalculation();
            });
        });

        // Real-time calculation triggers in Plan form
        const planInputs = ['plan-price', 'plan-tax', 'plan-seats', 'plan-withdraw-fee', 'plan-deposit-rate', 'plan-deposit-flat', 'plan-fx-fee', 'plan-okx-cny', 'plan-usd-cny', 'plan-usd-target', 'plan-tx-fee-spending'];
        planInputs.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                if (['plan-withdraw-fee', 'plan-deposit-rate', 'plan-deposit-flat', 'plan-fx-fee'].includes(id)) {
                    handleCardInputChange('plan');
                }
                if (id === 'plan-usd-cny') {
                    const usdCny = parseFloat(document.getElementById('plan-usd-cny').value) || 7.25;
                    document.getElementById('plan-okx-cny').placeholder = `例如：${usdCny.toFixed(2)}`;
                }
                runPlanCalculation();
            });
        });

        // Form submits to explicitly save history
        auditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const results = runAuditCalculation();
            if (results) {
                saveToHistory('记账回溯', `ChatGPT/Claude (${results.seats}席位)`, results.totalCny, results.leakRate, results.realRate, results.rawInputs);
                showToast('已成功归档一条审计记录！');
            }
        });

        planForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const results = runPlanCalculation();
            if (results) {
                saveToHistory('预算预估', `ChatGPT/Claude (${results.seats}席位)`, results.totalCny, results.leakRate, results.realRate, results.rawInputs);
                showToast('已成功归档一条测算记录！');
            }
        });

        // Clear history button
        if (btnClearHistory) {
            btnClearHistory.addEventListener('click', () => {
                if (confirm('确认清空所有历史存档吗？')) {
                    state.history = [];
                    localStorage.setItem('ratexray_history', JSON.stringify([]));
                    renderHistory();
                    showToast('历史记录已清空');
                }
            });
        }

        // Highlight nodes on hovering over breakdowns
        const breakdownItems = document.querySelectorAll('.breakdown-list li');
        breakdownItems.forEach((item, index) => {
            item.addEventListener('mouseenter', () => {
                highlightPipelineNode(index);
            });
            item.addEventListener('mouseleave', () => {
                resetPipelineHighlights();
            });
        });
    }

    function switchMode(mode) {
        state.mode = mode;
        if (mode === 'audit') {
            tabAudit.classList.add('active');
            tabPlan.classList.remove('active');
            
            auditFormContainer.classList.remove('hidden');
            auditFormContainer.style.display = 'block';
            auditFormContainer.style.opacity = '1';
            
            planFormContainer.classList.add('hidden');
            planFormContainer.style.display = 'none';
            
            if (activeModeLabel) {
                activeModeLabel.textContent = '记账回溯';
            }
            updateAuditIntermediates();
            runAuditCalculation();
        } else {
            tabAudit.classList.remove('active');
            tabPlan.classList.add('active');
            
            auditFormContainer.classList.add('hidden');
            auditFormContainer.style.display = 'none';
            
            planFormContainer.classList.remove('hidden');
            planFormContainer.style.display = 'block';
            planFormContainer.style.opacity = '1';
            
            if (activeModeLabel) {
                activeModeLabel.textContent = '预算测算';
            }
            runPlanCalculation();
        }
    }

    // Helper: Update auxiliary numbers directly beneath inputs
    function updateAuditIntermediates() {
        const cnyPaid = parseFloat(document.getElementById('audit-cny-paid').value) || 0;
        const withdrawFee = parseFloat(document.getElementById('audit-withdraw-fee').value) || 0;
        const depositRate = parseFloat(document.getElementById('audit-deposit-rate').value) || 0;
        const depositFlat = parseFloat(document.getElementById('audit-deposit-flat').value) || 0;
        const fxFee = parseFloat(document.getElementById('audit-fx-fee').value) || 0;
        const inrCharged = parseFloat(document.getElementById('audit-inr-charged').value) || 0;
        const currency = auditCurrencySelect.value;

        // Note: Smart estimate logic has been removed as requested

        const usdtGot = parseFloat(document.getElementById('audit-usdt-got').value) || 0;
        const usdDeducted = parseFloat(document.getElementById('audit-usd-deducted').value) || 0;

        // OKX Rate
        if (usdtGot > 0) {
            auditOkxRate.textContent = (cnyPaid / usdtGot).toFixed(4);
        } else {
            auditOkxRate.textContent = '0.0000';
        }

        // Deposit Loss
        const netUsdt = Math.max(0, usdtGot - withdrawFee);
        const loss = (netUsdt * (depositRate / 100)) + depositFlat;
        auditDepositLoss.textContent = loss.toFixed(2);

        // Card FX Rate
        const txFeeSpending = parseFloat(document.getElementById('audit-tx-fee-spending').value) || 0;
        const crossBorderFeeSpending = parseFloat(document.getElementById('audit-cross-border-fee-spending').value) || 0;
        const netUsdDeducted = Math.max(0, usdDeducted - txFeeSpending - crossBorderFeeSpending);

        if (inrCharged > 0 && netUsdDeducted > 0) {
            auditCardFxRate.textContent = (netUsdDeducted / inrCharged).toFixed(5);
        } else if (inrCharged > 0) {
            auditCardFxRate.textContent = (usdDeducted / inrCharged).toFixed(5);
        } else {
            auditCardFxRate.textContent = '0.00000';
        }
    }

    // Core Audit Math
    function runAuditCalculation() {
        // Collect values
        const cnyPaid = parseFloat(document.getElementById('audit-cny-paid').value) || 0;
        const usdtGot = parseFloat(document.getElementById('audit-usdt-got').value) || 0;
        const withdrawFee = parseFloat(document.getElementById('audit-withdraw-fee').value) || 0;
        const depositRate = parseFloat(document.getElementById('audit-deposit-rate').value) || 0;
        const depositFlat = parseFloat(document.getElementById('audit-deposit-flat').value) || 0;
        const fxFee = parseFloat(document.getElementById('audit-fx-fee').value) || 0;
        const inrCharged = parseFloat(document.getElementById('audit-inr-charged').value) || 0;
        const usdDeducted = parseFloat(document.getElementById('audit-usd-deducted').value) || 0;
        const seats = parseInt(document.getElementById('audit-seats').value) || 1;
        const currency = auditCurrencySelect.value;
        const txFeeSpending = parseFloat(document.getElementById('audit-tx-fee-spending').value) || 0;
        const crossBorderFeeSpending = parseFloat(document.getElementById('audit-cross-border-fee-spending').value) || 0;

        if (cnyPaid <= 0 || usdtGot <= 0 || usdDeducted <= 0) {
            const usdCnyOfficial = state.rates.usdCny;
            const usdTargetOfficial = currency === 'USD' ? 1 : (state.rates[`usd${currency.charAt(0) + currency.slice(1).toLowerCase()}`] || 83.50);
            renderResults({
                totalCny: 0,
                cnyPerSeat: 0,
                leakRate: 0,
                leakCny: 0,
                realRate: 0,
                officialRate: currency === 'USD' ? usdCnyOfficial : (1 / usdTargetOfficial * usdCnyOfficial),
                targetCurrency: currency,
                seats: seats,
                breakdown: {
                    service: 0,
                    okxPremium: 0,
                    withdraw: 0,
                    deposit: 0,
                    fx: 0,
                    pureFx: 0,
                    txSpending: 0,
                    crossBorderSpending: 0
                }
            });

            flowValCny.textContent = '0.00 CNY';
            flowValOkx.textContent = '0.00 USDT';
            flowValCard.textContent = '0.00 USD';
            flowValAi.textContent = `0.00 ${currency}`;

            flowFeeOkx.textContent = '-¥0.00 (0.0%)';
            flowFeeWithdraw.textContent = '-¥0.00 (0.0%)';
            flowFeeFx.textContent = '-¥0.00 (0.0%)';

            document.querySelector('#node-ai .node-name').textContent = `4. 官网付款 (${currency})`;
            return null;
        }

        // 1. Calculate step conversion ratios
        const okxRate = cnyPaid / usdtGot;
        const netUsdt = Math.max(0, usdtGot - withdrawFee);
        const depositLoss = (netUsdt * (depositRate / 100)) + depositFlat;
        const usdCredited = Math.max(0.01, netUsdt - depositLoss);

        // Funding cost per USD credited to card
        const fundingCostRate = cnyPaid / usdCredited; 

        // 2. Specific Transaction Allocation
        const totalCnyAllocated = usdDeducted * fundingCostRate;
        const cnyPerSeat = totalCnyAllocated / seats;

        // 3. Official Price Equivalent
        const usdCnyOfficial = state.rates.usdCny;
        const usdTargetOfficial = currency === 'USD' ? 1 : (state.rates[`usd${currency.charAt(0) + currency.slice(1).toLowerCase()}`] || 83.50);

        // Subscription base value in USD and CNY
        const usdOfficialBase = currency === 'USD' ? inrCharged : (inrCharged / usdTargetOfficial);
        const cnyOfficialBase = usdOfficialBase * usdCnyOfficial;

        // 4. Exact Friction Leaks Breakdown
        const leakageCny = Math.max(0, totalCnyAllocated - cnyOfficialBase);
        const leakageRate = (leakageCny / totalCnyAllocated) * 100;

        // Formula breakdown terms
        const serviceCny = cnyOfficialBase;
        const okxPremiumCny = Math.max(0, usdOfficialBase * (okxRate - usdCnyOfficial));
        const okxWithdrawCny = usdDeducted * okxRate * (withdrawFee / usdCredited);
        const cardDepositCny = usdDeducted * okxRate * (depositLoss / usdCredited);
        
        const cardTxFeeCny = txFeeSpending * fundingCostRate;
        const cardCrossBorderCny = crossBorderFeeSpending * fundingCostRate;
        const cardFxLossCny = Math.max(0, (usdDeducted - usdOfficialBase - txFeeSpending - crossBorderFeeSpending) * fundingCostRate);

        // 5. Real Comprehensive Exchange Rate
        const realCnyInr = totalCnyAllocated / inrCharged;

        // Render Outputs
        renderResults({
            totalCny: totalCnyAllocated,
            cnyPerSeat: cnyPerSeat,
            leakRate: leakageRate,
            leakCny: leakageCny,
            realRate: realCnyInr,
            officialRate: currency === 'USD' ? usdCnyOfficial : (1 / usdTargetOfficial * usdCnyOfficial),
            targetCurrency: currency,
            seats: seats,
            breakdown: {
                service: serviceCny,
                okxPremium: okxPremiumCny,
                withdraw: okxWithdrawCny,
                deposit: cardDepositCny,
                fx: cardFxLossCny + cardTxFeeCny + cardCrossBorderCny,
                pureFx: cardFxLossCny,
                txSpending: cardTxFeeCny,
                crossBorderSpending: cardCrossBorderCny
            }
        });

        // Update pipeline nodes values
        flowValCny.textContent = `${totalCnyAllocated.toFixed(2)} CNY`;
        flowValOkx.textContent = `${(usdDeducted * (usdtGot / usdCredited)).toFixed(2)} USDT`;
        flowValCard.textContent = `${usdDeducted.toFixed(2)} USD`;
        flowValAi.textContent = `${inrCharged.toFixed(0)} ${currency}`;

        // Node labels
        document.querySelector('#node-ai .node-name').textContent = `4. 官网付款 (${currency})`;

        // Visual losses on arrows (as absolute RMB cost)
        flowFeeOkx.textContent = `-¥${okxPremiumCny.toFixed(2)} (${((okxPremiumCny / totalCnyAllocated) * 100).toFixed(1)}%)`;
        flowFeeWithdraw.textContent = `-¥${(okxWithdrawCny + cardDepositCny).toFixed(2)} (${(((okxWithdrawCny + cardDepositCny) / totalCnyAllocated) * 100).toFixed(1)}%)`;
        flowFeeFx.textContent = `-¥${cardFxLossCny.toFixed(2)} (${((cardFxLossCny / totalCnyAllocated) * 100).toFixed(1)}%)`;

        return {
            totalCny: totalCnyAllocated,
            leakRate: leakageRate,
            realRate: realCnyInr,
            seats: seats,
            rawInputs: { cnyPaid, usdtGot, withdrawFee, depositRate, depositFlat, fxFee, inrCharged, usdDeducted, currency, smartEstimate: false, txFeeSpending, crossBorderFeeSpending }
        };
    }

    // Core Plan Math
    function runPlanCalculation() {
        const currency = planCurrencySelect.value;
        const price = parseFloat(document.getElementById('plan-price').value) || 0;
        const taxRate = parseFloat(document.getElementById('plan-tax').value) || 0;
        const seats = parseInt(document.getElementById('plan-seats').value) || 1;
        
        const usdCnyOfficial = parseFloat(document.getElementById('plan-usd-cny').value) || state.rates.usdCny;
        const usdTargetOfficial = parseFloat(planUsdTargetInput.value) || (currency === 'USD' ? 1 : (state.rates[`usd${currency.charAt(0) + currency.slice(1).toLowerCase()}`] || 83.50));

        // If price is 0 or empty, clear the dashboard to a neutral state
        if (price <= 0) {
            renderResults({
                totalCny: 0,
                cnyPerSeat: 0,
                leakRate: 0,
                leakCny: 0,
                realRate: 0,
                officialRate: currency === 'USD' ? usdCnyOfficial : (1 / usdTargetOfficial * usdCnyOfficial),
                targetCurrency: currency,
                seats: seats,
                breakdown: {
                    service: 0,
                    okxPremium: 0,
                    withdraw: 0,
                    deposit: 0,
                    fx: 0,
                    pureFx: 0,
                    txSpending: 0,
                    crossBorderSpending: 0
                }
            });

            flowValCny.textContent = '0.00 CNY';
            flowValOkx.textContent = '0.00 USDT';
            flowValCard.textContent = '0.00 USD';
            flowValAi.textContent = `0.00 ${currency}`;

            flowFeeOkx.textContent = '-¥0.00 (0.0%)';
            flowFeeWithdraw.textContent = '-¥0.00 (0.0%)';
            flowFeeFx.textContent = '-¥0.00 (0.0%)';

            document.querySelector('#node-ai .node-name').textContent = `4. 官网付款 (${currency})`;
            return null;
        }

        const withdrawFee = parseFloat(document.getElementById('plan-withdraw-fee').value) || 0;
        const depositRate = parseFloat(document.getElementById('plan-deposit-rate').value) || 0;
        const depositFlat = parseFloat(document.getElementById('plan-deposit-flat').value) || 0;
        const fxFeeRate = parseFloat(document.getElementById('plan-fx-fee').value) || 0;
        const txFeeRateSpending = parseFloat(document.getElementById('plan-tx-fee-spending').value) || 0;
        
        const okxCny = parseFloat(document.getElementById('plan-okx-cny').value) || usdCnyOfficial;

        // 1. Calculate Target Price in local currency
        const totalLocalCost = price * seats * (1 + taxRate / 100);

        // 2. Official reference USD equivalent
        let usdBase = totalLocalCost;
        if (currency !== 'USD') {
            usdBase = totalLocalCost / usdTargetOfficial;
        }

        // 3. Card FX and Transaction Fee
        let usdDeducted = usdBase;
        if (currency !== 'USD') {
            usdDeducted = usdBase * (1 + (fxFeeRate + txFeeRateSpending) / 100);
        } else {
            usdDeducted = usdBase * (1 + txFeeRateSpending / 100);
        }

        // 4. Trace back Card funding (Deposit & Withdrawal)
        const usdCredited = usdDeducted;
        const usdtNetRequired = (usdCredited + depositFlat) / (1 - depositRate / 100);
        const cardDepositLoss = (usdtNetRequired * (depositRate / 100)) + depositFlat;
        const usdtTotalRequired = usdtNetRequired + withdrawFee;

        // 5. Total CNY needed to buy USDT
        const totalCnyRequired = usdtTotalRequired * okxCny;
        const cnyPerSeat = totalCnyRequired / seats;

        // 6. Loss Breakdown
        const cnyOfficialBase = usdBase * usdCnyOfficial;
        const leakageCny = Math.max(0, totalCnyRequired - cnyOfficialBase);
        const leakageRate = (leakageCny / totalCnyRequired) * 100;

        // Breakdown items
        const serviceCny = cnyOfficialBase;
        const okxPremiumCny = usdBase * (okxCny - usdCnyOfficial);
        const okxWithdrawCny = withdrawFee * okxCny;
        const cardDepositCny = cardDepositLoss * okxCny;
        const cardFxLossCny = currency === 'USD' ? 0 : ((usdBase * (fxFeeRate / 100)) * okxCny);
        const cardTxFeeCny = (usdBase * (txFeeRateSpending / 100)) * okxCny;

        const realCnyRate = totalCnyRequired / totalLocalCost;

        // Render Outputs
        renderResults({
            totalCny: totalCnyRequired,
            cnyPerSeat: cnyPerSeat,
            leakRate: leakageRate,
            leakCny: leakageCny,
            realRate: realCnyRate,
            officialRate: currency === 'USD' ? usdCnyOfficial : (1 / usdTargetOfficial * usdCnyOfficial),
            targetCurrency: currency,
            seats: seats,
            breakdown: {
                service: serviceCny,
                okxPremium: okxPremiumCny,
                withdraw: okxWithdrawCny,
                deposit: cardDepositCny,
                fx: cardFxLossCny + cardTxFeeCny,
                pureFx: 0,
                txSpending: cardTxFeeCny,
                crossBorderSpending: cardFxLossCny
            }
        });

        // Update pipeline nodes
        flowValCny.textContent = `${totalCnyRequired.toFixed(2)} CNY`;
        flowValOkx.textContent = `${usdtTotalRequired.toFixed(2)} USDT`;
        flowValCard.textContent = `${usdDeducted.toFixed(2)} USD`;
        flowValAi.textContent = `${totalLocalCost.toFixed(0)} ${currency}`;

        // Node labels
        document.querySelector('#node-ai .node-name').textContent = `4. 官网付款 (${currency})`;

        // Visual losses on arrows in Planner mode
        flowFeeOkx.textContent = `-¥${okxPremiumCny.toFixed(2)} (${((okxPremiumCny / totalCnyRequired) * 100).toFixed(1)}%)`;
        flowFeeWithdraw.textContent = `-¥${(okxWithdrawCny + cardDepositCny).toFixed(2)} (${(((okxWithdrawCny + cardDepositCny) / totalCnyRequired) * 100).toFixed(1)}%)`;
        flowFeeFx.textContent = `-¥${cardFxLossCny.toFixed(2)} (${((cardFxLossCny / totalCnyRequired) * 100).toFixed(1)}%)`;

        return {
            totalCny: totalCnyRequired,
            leakRate: leakageRate,
            realRate: realCnyRate,
            seats: seats,
            rawInputs: { price, taxRate, seats, withdrawFee, depositRate, depositFlat, fxFeeRate, okxCny, usdCnyOfficial, usdTargetOfficial, currency, txFeeRateSpending }
        };
    }

    // Render results to DOM
    function renderResults(data) {
        // Main cost metrics
        resTotalCny.textContent = `¥ ${data.totalCny.toFixed(2)}`;
        resCnyPerSeat.textContent = `¥ ${data.cnyPerSeat.toFixed(2)}`;
        resLeakRate.textContent = `${data.leakRate.toFixed(2)}%`;
        resLeakBar.style.width = `${Math.min(100, data.leakRate)}%`;
        
        resLeakDesc.innerHTML = `有 <strong class="text-rose">¥${data.leakCny.toFixed(2)}</strong> 耗费在手续费与汇差溢价中`;
        if (resRealRate) {
            resRealRate.textContent = `${data.realRate.toFixed(4)}`;
        }
        
        if (resRealRateDesc) {
            const cnyTargetSymbol = `CNY/${data.targetCurrency}`;
            resRealRateDesc.innerHTML = `链路综合汇率: 1 ${data.targetCurrency} ≈ ${data.realRate.toFixed(4)} CNY <br> 官方汇率: 1 ${data.targetCurrency} ≈ ${data.officialRate.toFixed(4)} CNY`;
        }

        // Adjust leak rate color indicator based on overhead severity
        if (data.leakRate < 3.5) {
            resLeakRate.className = 'metric-value text-emerald';
            resLeakBar.className = 'progress-bar-fill bg-emerald';
        } else if (data.leakRate < 6.5) {
            resLeakRate.className = 'metric-value text-amber';
            resLeakBar.className = 'progress-bar-fill bg-amber';
        } else {
            resLeakRate.className = 'metric-value text-rose';
            resLeakBar.className = 'progress-bar-fill bg-rose';
        }

        // Segments breakdown progress-bar
        const totalBreakdown = data.breakdown.service + data.breakdown.okxPremium + data.breakdown.withdraw + data.breakdown.deposit + data.breakdown.fx;
        
        const pctService = (data.breakdown.service / totalBreakdown) * 100;
        const pctOkx = (data.breakdown.okxPremium / totalBreakdown) * 100;
        const pctWithdraw = (data.breakdown.withdraw / totalBreakdown) * 100;
        const pctDeposit = (data.breakdown.deposit / totalBreakdown) * 100;
        const pctFx = (data.breakdown.fx / totalBreakdown) * 100;

        // Clear and rebuild bar segments (if element exists)
        if (breakdownBar) {
            breakdownBar.innerHTML = `
                <div class="segment service" style="width: ${pctService}%" title="订阅服务净值: ${pctService.toFixed(1)}%">
                    <span class="segment-label">${pctService > 15 ? '订阅服务 ' + pctService.toFixed(1) + '%' : ''}</span>
                </div>
                <div class="segment okx-premium" style="width: ${pctOkx}%" title="买币溢价: ${pctOkx.toFixed(1)}%">
                    <span class="segment-label">${pctOkx > 15 ? '买币溢价 ' + pctOkx.toFixed(1) + '%' : ''}</span>
                </div>
                <div class="segment network-fee" style="width: ${pctWithdraw}%" title="提币手续费: ${pctWithdraw.toFixed(1)}%">
                    <span class="segment-label">${pctWithdraw > 15 ? '提币手续 ' + pctWithdraw.toFixed(1) + '%' : ''}</span>
                </div>
                <div class="segment deposit-fee" style="width: ${pctDeposit}%" title="卡充值费: ${pctDeposit.toFixed(1)}%">
                    <span class="segment-label">${pctDeposit > 15 ? '卡充值费 ' + pctDeposit.toFixed(1) + '%' : ''}</span>
                </div>
                <div class="segment fx-fee" style="width: ${pctFx}%" title="卡汇兑及消费损耗: ${pctFx.toFixed(1)}%">
                    <span class="segment-label">${pctFx > 15 ? '外币/交易 ' + pctFx.toFixed(1) + '%' : ''}</span>
                </div>
            `;
        }

        // Render breakdown list details dynamically (if element exists)
        const listContainer = document.getElementById('breakdown-details');
        
        if (listContainer) {
            let fxItemsHtml = '';
            
            if (data.breakdown.txSpending > 0 || data.breakdown.crossBorderSpending > 0) {
                // Detailed spending fees are provided! Split them up!
                const pureFxCny = data.breakdown.pureFx || 0;
                const txSpendingCny = data.breakdown.txSpending || 0;
                const cbSpendingCny = data.breakdown.crossBorderSpending || 0;
                
                const pctPureFx = (pureFxCny / totalBreakdown) * 100;
                const pctTxSpending = (txSpendingCny / totalBreakdown) * 100;
                const pctCbSpending = (cbSpendingCny / totalBreakdown) * 100;
                
                fxItemsHtml = `
                    <li>
                        <span class="legend-color fx-fee" style="background-color: #3b82f6;"></span>
                        <span class="item-name">卡消费时收取的<strong>交易费</strong> (Transaction Fee)</span>
                        <span class="item-val">¥${txSpendingCny.toFixed(2)} (${pctTxSpending.toFixed(1)}%)</span>
                    </li>
                    <li>
                        <span class="legend-color fx-fee" style="background-color: #60a5fa;"></span>
                        <span class="item-name">卡消费时收取的<strong>跨境费</strong> (Cross-border Fee)</span>
                        <span class="item-val">¥${cbSpendingCny.toFixed(2)} (${pctCbSpending.toFixed(1)}%)</span>
                    </li>
                    <li>
                        <span class="legend-color fx-fee" style="background-color: #1e3a8a;"></span>
                        <span class="item-name">卡消费多币种折算产生的<strong>纯汇差通道损耗</strong></span>
                        <span class="item-val">¥${pureFxCny.toFixed(2)} (${pctPureFx.toFixed(1)}%)</span>
                    </li>
                `;
            } else {
                // Fallback to standard combined FX fee
                fxItemsHtml = `
                    <li>
                        <span class="legend-color fx-fee"></span>
                        <span class="item-name">虚拟卡消费产生的外币兑换费/交易费/跨境手续费</span>
                        <span class="item-val">¥${data.breakdown.fx.toFixed(2)} (${pctFx.toFixed(1)}%)</span>
                    </li>
                `;
            }
            
            listContainer.innerHTML = `
                <li>
                    <span class="legend-color service"></span>
                    <span class="item-name">AI服务本身的官方原价 (无渠道中间商纯净折合人民币)</span>
                    <span class="item-val">¥${data.breakdown.service.toFixed(2)} (${pctService.toFixed(1)}%)</span>
                </li>
                <li>
                    <span class="legend-color okx-premium"></span>
                    <span class="item-name">在欧易买代币时多付的钱 (代币商家溢价损耗)</span>
                    <span class="item-val">¥${data.breakdown.okxPremium.toFixed(2)} (${pctOkx.toFixed(1)}%)</span>
                </li>
                <li>
                    <span class="legend-color network-fee"></span>
                    <span class="item-name">把币从欧易提现到虚拟卡产生的网络手续费 (提币Gas费)</span>
                    <span class="item-val">¥${data.breakdown.withdraw.toFixed(2)} (${pctWithdraw.toFixed(1)}%)</span>
                </li>
                <li>
                    <span class="legend-color deposit-fee"></span>
                    <span class="item-name">虚拟卡充值阶段扣除的手续费 (充值扣除费)</span>
                    <span class="item-val">¥${data.breakdown.deposit.toFixed(2)} (${pctDeposit.toFixed(1)}%)</span>
                </li>
                ${fxItemsHtml}
            `;
        }

        // Generate optimization tips
        generateOptimizationTips(data);
    }

    function generateOptimizationTips(data) {
        const tips = [];
        
        // 1. Check OKX Buy Premium
        const okxPct = (data.breakdown.okxPremium / data.totalCny) * 100;
        if (okxPct > 3) {
            tips.push({
                status: 'status-critical',
                statusTxt: '溢价偏高',
                title: 'OKX 买币溢价高',
                body: `买币溢价占总支出的 <strong>${okxPct.toFixed(1)}%</strong>。这通常因为提币或交易所当前C2C商户USDT买价偏高（如大于7.40元，而官方官方是7.25）。建议在工作日汇率稳定或交易所商家挂单价更低时，分批买入储存。`
            });
        } else {
            tips.push({
                status: 'status-good',
                statusTxt: '溢价正常',
                title: '买币通道顺畅',
                body: '当前OKX买币价格溢价正常，未发生大额价差损耗。'
            });
        }

        // 2. Check fixed fees relative to total transfer
        const withdrawPct = (data.breakdown.withdraw / data.totalCny) * 100;
        if (withdrawPct > 3.5) {
            tips.push({
                status: 'status-warning',
                statusTxt: '磨损警报',
                title: '小额充值导致固定手续费率过高',
                body: `提币网络固定费（1 USDT）占了本次费用的 <strong>${withdrawPct.toFixed(1)}%</strong>。建议<strong>单次大额多充</strong>一些余额放卡里备用，而不是每月零星充值，这能大幅稀释每次提币的固定手续费分摊！`
            });
        } else {
            tips.push({
                status: 'status-good',
                statusTxt: '损耗低',
                title: '提币分摊合理',
                body: '固定提现手续费已被交易总额充分稀释，单次损耗极小。'
            });
        }

        // 3. Check Virtual Card FX/Conversion Fees
        const fxPct = (data.breakdown.fx / data.totalCny) * 100;
        if (fxPct > 2.5 && data.targetCurrency !== 'USD') {
            tips.push({
                status: 'status-warning',
                statusTxt: '卡汇率磨损',
                title: '非美元交易货币兑换摩擦',
                body: `由于订阅印度等非美元账单，虚拟卡收取了 <strong>${fxPct.toFixed(1)}%</strong> 的货币转换损耗。对于一些虚拟卡，这可能因为额外征收了 1.2%-2% 的 Cross-Border (跨境外汇) 手续费。如果长期购买且卡片开卡能选，考虑寻找 0 外汇转换费的卡种，或者直接使用美国美元原生汇率订阅。`
            });
        } else if (data.targetCurrency === 'USD') {
            tips.push({
                status: 'status-good',
                statusTxt: '原生通道',
                title: '无外汇转换风险',
                body: '您使用USD直接订阅，无需承担多币种转换产生的跨境外币交易手续费。'
            });
        } else {
            tips.push({
                status: 'status-good',
                statusTxt: '磨损低',
                title: '外汇转换费用较低',
                body: '非美元汇率交易的损失控制在 2% 以内，卡片的跨境交易费率表现优良。'
            });
        }

        // 4. Check for spending fees rounding details
        if (data.breakdown.txSpending > 0 || data.breakdown.crossBorderSpending > 0) {
            tips.push({
                status: 'status-warning',
                statusTxt: '舍入摩擦',
                title: '卡片扣款美分舍入说明',
                body: '海外虚拟卡（如 Roogoo 乐享卡）在结算单笔手续费时，通常采用<strong>最小单位 (0.01 USD) 向上取整</strong>。这会导致单笔交易费和跨境费产生约 0.01 - 0.02 USD 的微小舍入溢价，属于正常结算特征。'
            });
        }

        // Re-render suggestions container
        if (proposalsContainer) {
            proposalsContainer.innerHTML = tips.map(tip => `
                <div class="proposal-card">
                    <span class="proposal-status ${tip.status}">${tip.statusTxt}</span>
                    <h4 class="proposal-title">${tip.title}</h4>
                    <p class="proposal-body">${tip.body}</p>
                </div>
            `).join('');
        }
    }

    // Node highlight triggers
    function highlightPipelineNode(index) {
        resetPipelineHighlights();
        
        // Match breakdown row with pipeline node
        // index mapping: 0=Service, 1=OKX Premium, 2=Withdraw, 3=Deposit, 4=FX
        if (index === 0) {
            document.getElementById('node-ai').classList.add('active-success');
        } else if (index === 1) {
            document.getElementById('node-okx').classList.add('active');
            flowFeeOkx.style.color = 'var(--accent-glow)';
            flowFeeOkx.style.borderColor = 'var(--accent-glow)';
        } else if (index === 2) {
            flowFeeWithdraw.style.color = 'var(--rose)';
            flowFeeWithdraw.style.borderColor = 'var(--rose)';
        } else if (index === 3) {
            document.getElementById('node-card').classList.add('active');
        } else if (index === 4) {
            flowFeeFx.style.color = 'var(--rose)';
            flowFeeFx.style.borderColor = 'var(--rose)';
            document.getElementById('node-ai').classList.add('active');
        }
    }

    function resetPipelineHighlights() {
        const nodes = document.querySelectorAll('.flow-node');
        nodes.forEach(n => {
            n.classList.remove('active-success');
            // Keep the first active
            if (n.id !== 'node-cny') {
                n.classList.remove('active');
            }
        });
        
        // Reset text style
        flowFeeOkx.style.color = '';
        flowFeeOkx.style.borderColor = '';
        flowFeeWithdraw.style.color = '';
        flowFeeWithdraw.style.borderColor = '';
        flowFeeFx.style.color = '';
        flowFeeFx.style.borderColor = '';
    }

    // Toast utility
    function showToast(msg) {
        const toast = document.getElementById('app-toast');
        toast.textContent = msg;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // History LocalStorage CRUD
    function saveToHistory(type, title, totalCny, leakRate, realRate, rawData) {
        const record = {
            id: Date.now(),
            time: new Date().toLocaleString('zh-CN', { hour12: false }),
            type: type,
            title: title,
            totalCny: totalCny,
            leakRate: leakRate,
            realRate: realRate,
            rawData: rawData
        };

        state.history.unshift(record);
        // Limit to 20 items
        if (state.history.length > 20) {
            state.history.pop();
        }

        localStorage.setItem('ratexray_history', JSON.stringify(state.history));
        renderHistory();
    }

    function loadHistory() {
        try {
            const raw = localStorage.getItem('ratexray_history');
            state.history = raw ? JSON.parse(raw) : [];
            renderHistory();
        } catch (e) {
            console.error('Error reading localStorage history', e);
            state.history = [];
        }
    }

    function deleteHistoryItem(id) {
        state.history = state.history.filter(item => item.id !== id);
        localStorage.setItem('ratexray_history', JSON.stringify(state.history));
        renderHistory();
        showToast('记录已删除');
    }

    function loadInputsFromRecord(id) {
        const item = state.history.find(r => r.id === id);
        if (!item) return;

        if (item.type === '记账回溯') {
            switchMode('audit');
            const data = item.rawData;
            
            // Set currency
            auditCurrencySelect.value = data.currency || 'INR';
            labelAuditInrCharged.textContent = `AI 官网账单金额 (${auditCurrencySelect.value})`;
            auditFxUnit.textContent = `USD/${auditCurrencySelect.value}`;

            document.getElementById('audit-cny-paid').value = data.cnyPaid;
            document.getElementById('audit-usdt-got').value = data.usdtGot;
            document.getElementById('audit-withdraw-fee').value = data.withdrawFee;
            document.getElementById('audit-deposit-rate').value = data.depositRate;
            document.getElementById('audit-deposit-flat').value = data.depositFlat || 0;
            document.getElementById('audit-fx-fee').value = data.fxFee || 1.2;
            document.getElementById('audit-inr-charged').value = data.inrCharged;
            document.getElementById('audit-usd-deducted').value = data.usdDeducted;

            // Set inputs to normal editable state (always editable)
            const usdtInput = document.getElementById('audit-usdt-got');
            const usdDeductedInput = document.getElementById('audit-usd-deducted');
            usdtInput.readOnly = false;
            usdDeductedInput.readOnly = false;
            usdtInput.setAttribute('required', '');
            usdDeductedInput.setAttribute('required', '');

            // Highlight active preset button if applicable
            const container = document.getElementById('audit-card-presets');
            if (container) {
                const btns = container.querySelectorAll('.preset-btn');
                btns.forEach(btn => {
                    const withdraw = parseFloat(btn.dataset.withdraw);
                    const deposit = parseFloat(btn.dataset.deposit);
                    const fx = parseFloat(btn.dataset.fx);
                    
                    if (withdraw === data.withdrawFee && deposit === data.depositRate && fx === (data.fxFee || 1.2)) {
                        btns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    }
                });
            }

            updateAuditIntermediates();
            runAuditCalculation();
        } else {
            switchMode('plan');
            const data = item.rawData;
            planCurrencySelect.value = data.currency || 'INR';
            document.getElementById('plan-price').value = data.price;
            document.getElementById('plan-tax').value = data.taxRate;
            document.getElementById('plan-seats').value = data.seats;
            document.getElementById('plan-withdraw-fee').value = data.withdrawFee;
            document.getElementById('plan-deposit-rate').value = data.depositRate;
            document.getElementById('plan-fx-fee').value = data.fxFeeRate;
            document.getElementById('plan-okx-cny').value = data.okxCny;
            document.getElementById('plan-usd-cny').value = data.usdCnyOfficial;
            planUsdTargetInput.value = data.usdTargetOfficial;
            
            // Highlight active preset button if applicable
            const container = document.querySelector('#plan-form-container .card-presets');
            if (container) {
                const btns = container.querySelectorAll('.preset-btn');
                btns.forEach(btn => {
                    const withdraw = parseFloat(btn.dataset.withdraw);
                    const deposit = parseFloat(btn.dataset.deposit);
                    const fx = parseFloat(btn.dataset.fx);
                    
                    if (withdraw === data.withdrawFee && deposit === data.depositRate && fx === data.fxFeeRate) {
                        btns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    }
                });
            }

            // Toggle plan select element events to adjust fields
            const event = new Event('change');
            planCurrencySelect.dispatchEvent(event);
            
            runPlanCalculation();
        }
        
        showToast('已加载选中历史记录参数');
    }

    function renderHistory() {
        if (!historyRows) return;
        if (state.history.length === 0) {
            historyRows.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-message">暂无历史记录</td>
                </tr>
            `;
            return;
        }

        historyRows.innerHTML = state.history.map(item => {
            const raw = item.rawData || {};
            const currencySymbol = raw.currency || 'INR';
            return `
                <tr style="cursor: pointer;" onclick="window.loadInputsFromRecord(${item.id})">
                    <td>${item.time}</td>
                    <td><span class="mode-label">${item.type}</span></td>
                    <td>${item.title}</td>
                    <td style="font-weight: 600;">¥ ${item.totalCny.toFixed(2)}</td>
                    <td class="${item.leakRate > 6 ? 'text-rose' : (item.leakRate > 3.5 ? 'text-amber' : 'text-emerald')}">
                        ¥ ${(item.totalCny * item.leakRate / 100).toFixed(2)} (${item.leakRate.toFixed(1)}%)
                    </td>
                    <td style="font-family: 'Outfit', sans-serif;">${item.realRate.toFixed(4)} CNY/${currencySymbol}</td>
                    <td>
                        <button class="delete-row-btn" onclick="event.stopPropagation(); window.deleteHistoryItem(${item.id});" title="删除记录">
                            <svg class="delete-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; vertical-align: middle; display: inline-block;">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Update tab badges
        updateDashboardBadges();
    }

    function updateDashboardBadges() {
        const proposalBadge = document.getElementById('proposal-badge');
        const historyBadge = document.getElementById('history-badge');

        if (historyBadge) {
            historyBadge.textContent = state.history.length;
        }

        if (proposalBadge) {
            const hasWarnings = document.querySelector('#proposals-container .status-critical, #proposals-container .status-warning');
            if (hasWarnings) {
                proposalBadge.classList.remove('hidden');
            } else {
                proposalBadge.classList.add('hidden');
            }
        }
    }

    // Expose helpers globally to allow inline event hooks
    window.deleteHistoryItem = deleteHistoryItem;
    window.loadInputsFromRecord = loadInputsFromRecord;
});
