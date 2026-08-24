(function exposePaymentsCore(root) {
  "use strict";

  function parseAmountToAgorot(value) {
    const text = String(value ?? "").trim();
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) return null;
    const [shekels, fraction = ""] = text.split(".");
    const agorot = Number(shekels) * 100 + Number(`${fraction}00`.slice(0, 2));
    return agorot > 0 ? agorot : null;
  }

  function agorotToAmountText(agorot) {
    const value = Number(agorot) || 0;
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  }

  function chargeOrderKey(charge) {
    return `${charge?.session_date || "9999-99-99"} ${charge?.created_at || ""} ${charge?.id || ""}`;
  }

  function sortChargesOldestFirst(charges) {
    return [...(charges || [])].sort((a, b) => chargeOrderKey(a).localeCompare(chargeOrderKey(b)));
  }

  function chargeStatus(amountAgorot, paidAgorot) {
    if (amountAgorot > 0 && paidAgorot >= amountAgorot) return "paid";
    if (paidAgorot > 0) return "partial";
    return "unpaid";
  }

  function chargeBalances(charges, allocations) {
    const paidByCharge = new Map();
    for (const allocation of allocations || []) {
      const agorot = parseAmountToAgorot(allocation?.amount);
      if (agorot === null || !allocation?.charge_id) continue;
      paidByCharge.set(allocation.charge_id, (paidByCharge.get(allocation.charge_id) || 0) + agorot);
    }
    return sortChargesOldestFirst(charges).map((charge) => {
      const amountAgorot = parseAmountToAgorot(charge?.amount) || 0;
      const paidAgorot = paidByCharge.get(charge?.id) || 0;
      return {
        chargeId: charge?.id || "",
        sessionId: charge?.session_id || "",
        patientId: charge?.patient_id || "",
        sessionDate: charge?.session_date || "",
        createdAt: charge?.created_at || "",
        amountAgorot,
        paidAgorot,
        remainingAgorot: Math.max(0, amountAgorot - paidAgorot),
        status: chargeStatus(amountAgorot, paidAgorot)
      };
    });
  }

  function outstandingTotal(balances) {
    return (balances || []).reduce((total, balance) => total + (balance?.remainingAgorot || 0), 0);
  }

  function planAllocations(openBalances, paymentAgorot) {
    if (!Number.isSafeInteger(paymentAgorot) || paymentAgorot <= 0) {
      return { error: "invalid_amount", allocations: [] };
    }
    const ordered = [...(openBalances || [])].sort((a, b) =>
      `${a?.sessionDate || "9999-99-99"} ${a?.createdAt || ""} ${a?.chargeId || ""}`.localeCompare(
        `${b?.sessionDate || "9999-99-99"} ${b?.createdAt || ""} ${b?.chargeId || ""}`
      )
    );
    const totalRemaining = outstandingTotal(ordered);
    if (paymentAgorot > totalRemaining) {
      return { error: "overpayment", allocations: [] };
    }
    const allocations = [];
    let rest = paymentAgorot;
    for (const balance of ordered) {
      if (rest <= 0) break;
      const take = Math.min(rest, balance.remainingAgorot || 0);
      if (take <= 0) continue;
      allocations.push({
        chargeId: balance.chargeId,
        sessionId: balance.sessionId,
        patientId: balance.patientId,
        amountAgorot: take
      });
      rest -= take;
    }
    return { error: "", allocations };
  }

  const api = {
    parseAmountToAgorot,
    agorotToAmountText,
    sortChargesOldestFirst,
    chargeStatus,
    chargeBalances,
    outstandingTotal,
    planAllocations
  };
  root.CLINIC_PAYMENTS_CORE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
