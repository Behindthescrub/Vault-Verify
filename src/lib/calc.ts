// Bill-to-Pay Staffing Calculator — faithful port of the original HTML tool's math.
// Margin (blended hourly, OT-aware) → traveler stipend split with min-W2 floor.

export type CalcInputs = {
  billRate: number
  mspFeePct: number
  payRate: number
  onboardingPct: number
  hoursPerWeek: number
  otEnabled: boolean
  otThreshold: number
  otMultiplier: number
  travelerMode: boolean
  stipendWeekly: number
}

export type CalcSettings = {
  minW2: number
}

export type CalcResults = {
  // weekly candidate pay
  regHours: number
  otHours: number
  otActive: boolean
  regPay: number
  otPay: number
  totalWeeklyPay: number
  blendedPayHourly: number
  // bill side (weekly → blended hourly)
  blendedMspHourly: number
  blendedNetBillHourly: number
  // split
  stipendWeekly: number
  stipendHourly: number
  w2Weekly: number
  w2Hourly: number
  // floor state
  minWageApplied: boolean
  minWageUndersold: boolean
  // costs & margin
  onboardCostHourly: number
  costToCompanyHourly: number
  marginHourly: number
  marginPct: number
}

export function computeCalc(inputs: CalcInputs, settings: CalcSettings): CalcResults {
  const bill = inputs.billRate
  const msp = inputs.mspFeePct / 100
  const pay = inputs.payRate
  const onboardPct = inputs.onboardingPct / 100
  const hours = Math.max(0.01, inputs.hoursPerWeek)
  const otThreshold = inputs.otEnabled ? Math.max(0, inputs.otThreshold) : 0
  const otMultiplier = inputs.otEnabled ? Math.max(1, inputs.otMultiplier) : 1
  const travelerMode = inputs.travelerMode
  const minW2 = settings.minW2 || 0

  // Overtime split
  let regHours = hours
  let otHours = 0
  if (otThreshold > 0 && hours > otThreshold) {
    regHours = otThreshold
    otHours = hours - otThreshold
  }
  const otActive = otHours > 0

  // Candidate pay side (weekly)
  const regPay = pay * regHours
  const otPay = pay * otMultiplier * otHours
  const totalWeeklyPay = regPay + otPay
  const blendedPayHourly = hours > 0 ? totalWeeklyPay / hours : pay

  // Bill side (weekly → blended hourly)
  const regBill = bill * regHours
  const otBill = bill * otMultiplier * otHours
  const totalWeeklyBill = regBill + otBill
  const mspAmtWeekly = totalWeeklyBill * msp
  const netBillWeekly = totalWeeklyBill - mspAmtWeekly
  const blendedMspHourly = hours > 0 ? mspAmtWeekly / hours : 0
  const blendedNetBillHourly = hours > 0 ? netBillWeekly / hours : 0

  // Stipend split (traveler mode)
  let stipendWeekly = 0
  if (travelerMode) stipendWeekly = Math.min(inputs.stipendWeekly, totalWeeklyPay)
  let stipendHourly = hours > 0 ? stipendWeekly / hours : 0
  let w2Weekly = totalWeeklyPay - stipendWeekly
  let w2Hourly = hours > 0 ? w2Weekly / hours : 0

  // Minimum W2 floor (on blended W2 hourly)
  let minWageApplied = false
  let minWageUndersold = false
  if (minW2 > 0) {
    if (travelerMode) {
      if (blendedPayHourly < minW2) {
        // Total pay too low to ever meet the floor
        w2Hourly = blendedPayHourly
        stipendHourly = 0
        stipendWeekly = 0
        w2Weekly = totalWeeklyPay
        minWageUndersold = true
      } else if (w2Hourly < minW2) {
        // Raise W2 to the floor; pull the difference from stipend
        w2Hourly = minW2
        w2Weekly = minW2 * hours
        stipendWeekly = Math.max(0, totalWeeklyPay - w2Weekly)
        stipendHourly = hours > 0 ? stipendWeekly / hours : 0
        minWageApplied = true
      }
    } else {
      if (w2Hourly < minW2) minWageUndersold = true
    }
  }

  // Onboarding applies to the W2 portion only (blended)
  const onboardCostHourly = w2Hourly * onboardPct
  const costToCompanyHourly = blendedPayHourly + onboardCostHourly

  // Margin (blended hourly)
  const marginHourly = blendedNetBillHourly - costToCompanyHourly
  const marginPct = blendedNetBillHourly !== 0 ? (marginHourly / blendedNetBillHourly) * 100 : 0

  return {
    regHours, otHours, otActive,
    regPay, otPay, totalWeeklyPay, blendedPayHourly,
    blendedMspHourly, blendedNetBillHourly,
    stipendWeekly, stipendHourly, w2Weekly, w2Hourly,
    minWageApplied, minWageUndersold,
    onboardCostHourly, costToCompanyHourly,
    marginHourly, marginPct,
  }
}

export function money(x: number): string {
  return '$' + Number(x || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
