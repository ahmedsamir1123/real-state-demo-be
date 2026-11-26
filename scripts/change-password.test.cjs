const assert = require('node:assert/strict')
const test = require('node:test')
const bcrypt = require('bcryptjs')
const { User } = require('../dist/db/model/user/user.model')
const { AuthService } = require('../dist/modules/auth/auth.service')
const router = require('../dist/modules/auth/auth.controller').default
const { authenticate } = require('../dist/modules/auth/auth.middleware')

test('password change requires authentication and is available to every role', () => {
  const route = router.stack.find((layer) => layer.route?.path === '/change-password').route
  assert.equal(route.methods.post, true)
  assert.equal(route.stack[0].handle, authenticate)
  assert.equal(route.stack.length, 2)
})

test('password change validates input and only updates the authenticated account', async () => {
  const originalFind = User.findById
  const originalUpdate = User.updateOne
  const currentPassword = 'Current-Test-Password'
  const newPassword = 'Updated-Test-Password'
  const password = await bcrypt.hash(currentPassword, 4)
  let write
  User.findById = (id) => {
    assert.equal(id, 'signed-in-user')
    return { select: async (fields) => {
      assert.equal(fields, '+password')
      return { id, password }
    } }
  }
  User.updateOne = async (filter, update) => {
    write = { filter, update }
    return { modifiedCount: 1 }
  }
  const service = new AuthService()
  const request = (body) => ({ user: { id: 'signed-in-user', role: 'sales' }, body })
  const response = { status(code) { assert.equal(code, 200); return this }, json(body) { return body } }
  try {
    for (const body of [undefined, {}, { currentPassword: 123, newPassword }, { currentPassword, newPassword: [] }, { currentPassword, newPassword: 'short' }, { currentPassword, newPassword: currentPassword }]) {
      await assert.rejects(service.changePassword(request(body), response), { statusCode: 400 })
    }
    await assert.rejects(service.changePassword(request({ currentPassword: 'wrong-password', newPassword }), response), /current password is incorrect/)
    assert.equal(write, undefined)
    const result = await service.changePassword(request({ currentPassword, newPassword, id: 'another-user', role: 'admin' }), response)
    assert.equal(result.success, true)
    assert.deepEqual(write.filter, { _id: 'signed-in-user', password })
    assert.deepEqual(Object.keys(write.update.$set), ['password'])
    assert.notEqual(write.update.$set.password, newPassword)
    assert.equal(await bcrypt.compare(newPassword, write.update.$set.password), true)
    assert.equal(await bcrypt.compare(currentPassword, write.update.$set.password), false)
    assert.deepEqual(write.update.$unset, { refreshTokenHash: 1 })
    User.updateOne = async () => ({ modifiedCount: 0 })
    await assert.rejects(service.changePassword(request({ currentPassword, newPassword }), response), /current password is incorrect/)
  } finally {
    User.findById = originalFind
    User.updateOne = originalUpdate
  }
})
