async function pastikanCustomerAccount(tx, accountId, customerId, requireActive = true) {
  const [account, customer] = await Promise.all([
    tx.master_account.findUnique({ where: { id: accountId } }),
    tx.master_customer.findUnique({ where: { id: customerId } })
  ]);

  if (!account || !customer || customer.account_id !== account.kode_account || (requireActive && (!account.aktif || !customer.aktif))) {
    throw Object.assign(new Error("Pilih Customer aktif yang sesuai dengan Account."), { statusCode: 422 });
  }
  return { account, customer };
}

module.exports = { pastikanCustomerAccount };
