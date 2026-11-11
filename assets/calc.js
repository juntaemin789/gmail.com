/*
 * 계산 로직 (브라우저 + Node 테스트 공용)
 * 모든 금액은 원 단위. 결과는 "추정치"이며 실제 원천징수액과 다를 수 있음.
 */
(function (root) {
  'use strict';

  // ---- 2026년 기준 요율 (매년 확인 후 수정) ----
  var RATES = {
    year: 2026,
    pension: 0.0475,          // 국민연금 근로자 부담 (총 9.5%의 절반)
    pensionMax: 6370000,      // 국민연금 기준소득월액 상한
    pensionMin: 400000,       // 국민연금 기준소득월액 하한
    health: 0.03595,          // 건강보험 근로자 부담 (총 7.19%의 절반)
    longTermCare: 0.1314,     // 장기요양보험 = 건강보험료 × 13.14%
    employment: 0.009,        // 고용보험 근로자 부담
    localTax: 0.1             // 지방소득세 = 소득세 × 10%
  };

  function floor10(n) { return Math.floor(n / 10) * 10; }

  // 근로소득공제 (연 총급여 기준)
  function earnedIncomeDeduction(gross) {
    var d;
    if (gross <= 5000000) d = gross * 0.7;
    else if (gross <= 15000000) d = 3500000 + (gross - 5000000) * 0.4;
    else if (gross <= 45000000) d = 7500000 + (gross - 15000000) * 0.15;
    else if (gross <= 100000000) d = 12000000 + (gross - 45000000) * 0.05;
    else d = 14750000 + (gross - 100000000) * 0.02;
    return Math.min(d, 20000000);
  }

  // 종합소득세 기본세율 (누진공제 방식)
  function progressiveTax(base) {
    if (base <= 0) return 0;
    var brackets = [
      [14000000, 0.06, 0],
      [50000000, 0.15, 1260000],
      [88000000, 0.24, 5760000],
      [150000000, 0.35, 15440000],
      [300000000, 0.38, 19940000],
      [500000000, 0.40, 25940000],
      [1000000000, 0.42, 35940000],
      [Infinity, 0.45, 65940000]
    ];
    for (var i = 0; i < brackets.length; i++) {
      if (base <= brackets[i][0]) return base * brackets[i][1] - brackets[i][2];
    }
    return 0;
  }

  // 근로소득세액공제 (한도 포함)
  function earnedIncomeTaxCredit(tax, gross) {
    var credit = tax <= 1300000 ? tax * 0.55 : 715000 + (tax - 1300000) * 0.3;
    var limit;
    if (gross <= 33000000) limit = 740000;
    else if (gross <= 70000000) limit = Math.max(740000 - (gross - 33000000) * 0.008, 660000);
    else if (gross <= 120000000) limit = Math.max(660000 - (gross - 70000000) * 0.5, 500000);
    else limit = Math.max(500000 - (gross - 120000000) * 0.5, 200000);
    return Math.min(credit, limit);
  }

  /**
   * 연봉 실수령액
   * @param {number} annualSalary 연봉(세전)
   * @param {object} opt { nonTaxableMonthly: 비과세액(월, 기본 식대 20만), dependents: 부양가족 수(본인 포함, 기본 1) }
   */
  function salary(annualSalary, opt) {
    opt = opt || {};
    var nonTaxable = opt.nonTaxableMonthly != null ? opt.nonTaxableMonthly : 200000;
    var dependents = Math.max(1, opt.dependents || 1);

    var monthly = annualSalary / 12;
    var taxableMonthly = Math.max(0, monthly - nonTaxable);

    var pensionBase = Math.min(Math.max(taxableMonthly, RATES.pensionMin), RATES.pensionMax);
    if (taxableMonthly === 0) pensionBase = 0;
    var pension = floor10(pensionBase * RATES.pension);
    var health = floor10(taxableMonthly * RATES.health);
    var care = floor10(health * RATES.longTermCare);
    var employment = floor10(taxableMonthly * RATES.employment);

    // 연 단위 소득세 추정 → 월 환산
    var grossAnnual = taxableMonthly * 12;
    var base = grossAnnual
      - earnedIncomeDeduction(grossAnnual)
      - 1500000 * dependents
      - pension * 12
      - (health + care + employment) * 12;
    var tax = progressiveTax(Math.max(0, base));
    tax = Math.max(0, tax - earnedIncomeTaxCredit(tax, grossAnnual) - 130000); // 표준세액공제 13만
    var incomeTax = floor10(tax / 12);
    var localTax = floor10(incomeTax * RATES.localTax);

    var totalDeduction = pension + health + care + employment + incomeTax + localTax;
    var net = Math.round(monthly - totalDeduction);

    return {
      monthlyGross: Math.round(monthly),
      pension: pension,
      health: health,
      longTermCare: care,
      employment: employment,
      incomeTax: incomeTax,
      localTax: localTax,
      totalDeduction: totalDeduction,
      monthlyNet: net,
      annualNet: net * 12
    };
  }

  /**
   * 대출 상환 계산
   * @param {number} principal 대출 원금
   * @param {number} annualRate 연 이자율 (%)
   * @param {number} months 대출 기간 (개월)
   * @param {string} method 'equal' 원리금균등 | 'principal' 원금균등 | 'bullet' 만기일시
   */
  function loan(principal, annualRate, months, method) {
    var r = annualRate / 100 / 12;
    var schedule = [];
    var balance = principal;
    var totalInterest = 0;
    var payment;

    if (method === 'equal') {
      payment = r === 0 ? principal / months
        : principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    }

    for (var i = 1; i <= months; i++) {
      var interest = balance * r;
      var principalPaid;
      if (method === 'equal') principalPaid = payment - interest;
      else if (method === 'principal') principalPaid = principal / months;
      else principalPaid = i === months ? balance : 0;

      if (i === months) principalPaid = balance; // 마지막 회차 잔액 정리
      balance -= principalPaid;
      totalInterest += interest;
      schedule.push({
        month: i,
        payment: Math.round(principalPaid + interest),
        principal: Math.round(principalPaid),
        interest: Math.round(interest),
        balance: Math.max(0, Math.round(balance))
      });
    }

    return {
      firstPayment: schedule.length ? schedule[0].payment : 0,
      totalInterest: Math.round(totalInterest),
      totalPayment: Math.round(principal + totalInterest),
      schedule: schedule
    };
  }

  function daysBetween(a, b) {
    var MS = 86400000;
    var ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    var ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((ub - ua) / MS);
  }

  /**
   * 퇴직금 계산
   * @param {Date} start 입사일
   * @param {Date} end 퇴직일 (마지막 근무일의 다음 날)
   * @param {number} wage3m 퇴직 전 3개월 급여 총액
   * @param {number} annualBonus 연간 상여금
   * @param {number} annualLeavePay 연차수당 (연간)
   */
  function severance(start, end, wage3m, annualBonus, annualLeavePay) {
    var serviceDays = daysBetween(start, end);
    var threeMonthsAgo = new Date(end.getFullYear(), end.getMonth() - 3, end.getDate());
    var days3m = daysBetween(threeMonthsAgo, end);

    var wageTotal = wage3m + (annualBonus || 0) * 3 / 12 + (annualLeavePay || 0) * 3 / 12;
    var dailyAvg = days3m > 0 ? wageTotal / days3m : 0;
    var pay = dailyAvg * 30 * serviceDays / 365;

    return {
      eligible: serviceDays >= 365,
      serviceDays: serviceDays,
      days3m: days3m,
      dailyAverageWage: Math.round(dailyAvg),
      severancePay: serviceDays >= 365 ? Math.round(pay) : 0
    };
  }

  var api = {
    RATES: RATES,
    salary: salary,
    loan: loan,
    severance: severance,
    _internal: { earnedIncomeDeduction: earnedIncomeDeduction, progressiveTax: progressiveTax }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
