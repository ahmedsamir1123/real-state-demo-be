const apiBase = process.env.API_URL || 'http://localhost:3000'
const suffix = Date.now()
let projectId
let offerId

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json()
  if (!response.ok || body.success === false) {
    throw new Error(`${options.method || 'GET'} ${path}: ${body.message || response.status}`)
  }
  return body.data
}

try {
  const project = await request('/project', {
    method: 'POST',
    body: JSON.stringify({
      name: `API smoke project ${suffix}`,
      code: `T${String(suffix).slice(-8)}`,
      location: 'Integration test',
      status: 'active',
      description: 'Temporary record created by the API smoke test',
      financialPolicy: { annualDiscountRate: 14, handoverMonth: 48, requiredCollectionPct: 55, maintenancePct: 8 },
      paymentPlans: [
        { name: 'Five years', code: '5Y', isActive: true, isDefault: true, discountPct: 0, downPaymentPct: 20, years: 5, frequencyMonths: 3, installmentDistribution: 'front_loaded', loadFactorPct: 20, milestones: [], installmentSegments: [], settleDifferenceAtYearEnd: false },
        { name: 'Seven years', code: '7Y', isActive: false, isDefault: false, discountPct: 0, downPaymentPct: 10, years: 7, frequencyMonths: 3, milestones: [{ installmentNumber: 4, percentage: 5, spreadOverYearInstallments: false }], installmentSegments: [], settleDifferenceAtYearEnd: false },
      ],
    }),
  })
  projectId = project._id

  const updatedProject = await request(`/project/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify({ description: 'Updated by the API smoke test' }),
  })
  if (updatedProject.description !== 'Updated by the API smoke test') throw new Error('Project update did not return the updated document')

  if (project.paymentPlans.length !== 2 || !project.paymentPlans.some((plan) => plan.isDefault) || project.paymentPlans[0].installmentDistribution !== 'front_loaded') throw new Error('Project payment plans were not stored correctly')

  const offer = await request('/offer', {
    method: 'POST',
    body: JSON.stringify({
      offerNo: `SMOKE-${suffix}`,
      project: projectId,
      projectPaymentPlan: { sourceId: project.paymentPlans[0]._id, name: project.paymentPlans[0].name, code: project.paymentPlans[0].code },
      projectSnapshot: { name: project.name, code: project.code },
      customer: { name: 'Smoke Test Customer', phone: '01000000000' },
      salesAgent: { name: 'Smoke Test Agent' },
      unit: { code: 'TEST-1', type: 'Test unit', area: 100, pricePerMeter: 10000, listPrice: 1000000 },
      contractDate: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      financialInputs: { marketingDiscountPct: 0, annualDiscountRate: 14, handoverMonth: 48, requiredCollectionPct: 55, addonAmount: 0, maintenancePct: 8, includeAddonsInNpv: false },
      basePlan: { discountPct: 0, downPaymentPct: 10, years: 7, frequencyMonths: 3, milestones: [], installmentSegments: [], settleDifferenceAtYearEnd: false },
      customerPlan: { discountPct: 0, downPaymentPct: 20, years: 5, frequencyMonths: 3, milestones: [], installmentSegments: [], settleDifferenceAtYearEnd: true },
      calculationResult: {
        finalPrice: 1000000, downPaymentAmount: 200000, regularInstallmentAmount: 40000, installmentsCount: 20,
        basePlanNpv: 700000, customerPlanNpv: 710000, npvDifference: 10000, collectedAtHandover: 840000,
        collectedAtHandoverPct: 0.84, totalMaintenance: 80000, npvPassed: true, collectionPassed: true, accepted: true,
      },
      paymentSchedule: [{ month: 0, dueDate: new Date().toISOString(), type: 'down_payment', label: 'down payment', amount: 200000, cumulativeAmount: 200000, cumulativePct: 0.2, isHandover: false }],
      maintenanceSchedule: [],
      notes: 'Temporary record created by the API smoke test',
      status: 'draft',
      calculationVersion: 1,
    }),
  })
  offerId = offer._id

  const latest = await request('/offer/latest')
  if (latest?._id !== offerId) throw new Error('Latest offer endpoint returned an unexpected record')

  const updatedOffer = await request(`/offer/${offerId}`, {
    method: 'PUT',
    body: JSON.stringify({ notes: 'Updated by the API smoke test' }),
  })
  if (updatedOffer.notes !== 'Updated by the API smoke test') throw new Error('Offer update did not return the updated document')

  const exceptionApprovedOffer = await request(`/offer/${offerId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'approved', approvedAt: new Date().toISOString() }),
  })
  if (exceptionApprovedOffer.status !== 'approved' || !exceptionApprovedOffer.approvedAt) throw new Error('Exception approval was not stored correctly')

  console.log('API smoke test passed: project and offer flows are working')
} finally {
  if (offerId) await request(`/offer/${offerId}`, { method: 'DELETE' }).catch(() => {})
  if (projectId) await request(`/project/${projectId}`, { method: 'DELETE' }).catch(() => {})
}
