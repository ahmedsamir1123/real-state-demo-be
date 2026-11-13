const assert = require('node:assert/strict')
const test = require('node:test')
const { Types } = require('mongoose')
const { User } = require('../dist/db/model/user/user.model')
const { OfferService } = require('../dist/modules/offer/offer.service')
const { authorize } = require('../dist/modules/auth/auth.middleware')
const projectRouter = require('../dist/modules/project/project.controller').default

const managerId = new Types.ObjectId()
const salesId = new Types.ObjectId()
const response = () => ({ status() { return this }, json(value) { return value } })

test('manager sees own and assigned sales offers; department manager sees all', async () => {
  const originalFind = User.find
  let teamQuery
  User.find = (query) => {
    teamQuery = query
    return { select: () => ({ lean: async () => [{ _id: salesId }] }) }
  }
  try {
    const service = new OfferService()
    let filter
    service.offerRepository.getAll = async (value) => { filter = value; return [] }
    await service.get({ user: { id: String(managerId), role: 'manager' } }, response())
    assert.equal(teamQuery.role, 'sales')
    assert.equal(String(teamQuery.managerId), String(managerId))
    assert.deepEqual(filter.createdBy.$in.map(String), [String(managerId), String(salesId)])

    await service.get({ user: { id: String(salesId), role: 'sales' } }, response())
    assert.equal(String(filter.createdBy), String(salesId))

    await service.get({ user: { id: String(managerId), role: 'department_manager' } }, response())
    assert.deepEqual(filter, {})
  } finally {
    User.find = originalFind
  }
})

test('editing an offer cannot approve it and managers can only edit their own offers', async () => {
  const service = new OfferService()
  let filter
  let update
  service.offerRepository.update = async (nextFilter, nextUpdate) => {
    filter = nextFilter
    update = nextUpdate
    return { status: 'pending_approval' }
  }
  await service.update({
    params: { id: String(new Types.ObjectId()) },
    user: { id: String(managerId), role: 'manager' },
    body: { status: 'approved', approvedAt: new Date(), calculationResult: { accepted: false } },
  }, response())
  assert.equal(String(filter.createdBy), String(managerId))
  assert.equal(update.$set.status, 'pending_approval')
  assert.equal(update.$set.approvedAt, undefined)
  assert.equal(update.$unset.approvedAt, 1)
})

test('only admin passes the exception decision authorization', () => {
  const gate = authorize('admin')
  let error
  gate({ user: { role: 'manager' } }, {}, (reason) => { error = reason })
  assert.equal(error?.statusCode, 403)
  gate({ user: { role: 'department_manager' } }, {}, (reason) => { error = reason })
  assert.equal(error?.statusCode, 403)
  gate({ user: { role: 'admin' } }, {}, (reason) => { error = reason })
  assert.equal(error, undefined)
})

test('project creation, editing and deletion require admin', () => {
  for (const method of ['post', 'put', 'delete']) {
    const route = projectRouter.stack.find((layer) => layer.route?.methods[method])?.route
    assert.ok(route, `${method} project route exists`)
    const gate = route.stack[0].handle
    let error
    gate({ user: { role: 'manager' } }, {}, (reason) => { error = reason })
    assert.equal(error?.statusCode, 403)
    gate({ user: { role: 'admin' } }, {}, (reason) => { error = reason })
    assert.equal(error, undefined)
  }
})
