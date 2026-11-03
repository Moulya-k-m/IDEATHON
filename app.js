                      <p className="text-[11px] text-slate-400">Capacity 500</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold text-[10px]">Available</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* REQUESTS TAB */}
          {activeTab === 'Requests' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 max-w-xl">
              <h4 className="font-bold text-slate-800">Raise a request</h4>
              <form onSubmit={handleRaiseRequest} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-600 font-semibold">Campus</label>
                  <select value={reqCamp} onChange={(e) => setReqCamp(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg">
                    <option>Campus A</option>
                    <option>Campus B</option>
                    <option>Campus C</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 font-semibold">Resource</label>
                  <select value={reqResource} onChange={(e) => setReqResource(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg">
                    <option value="medicine">medicine</option>
                    <option value="water">water</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 font-semibold">Quantity needed</label>
                    <input type="text" value={reqQty} onChange={(e) => setReqQty(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold">Needed within (hours)</label>
                    <input type="text" value={reqHours} onChange={(e) => setReqHours(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg" />
                  </div>
                </div>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg cursor-pointer">
                  Raise request
                </button>
              </form>
            </div>
          )}

          {/* DONORS TAB */}
          {activeTab === 'Donors' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 max-w-xl">
              <h4 className="font-bold text-slate-800">Offer a donation</h4>
              <form onSubmit={handleOfferDonation} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-600 font-semibold">Donor Name</label>
                  <input type="text" value={donorName} onChange={(e) => setDonorName(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 font-semibold">Resource</label>
                    <select value={donorResource} onChange={(e) => setDonorResource(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg">
                      <option value="water">water</option>
                      <option value="medicine">medicine</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold">Quantity</label>
                    <input type="text" value={donorQty} onChange={(e) => setDonorQty(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg" />
                  </div>
                </div>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg cursor-pointer">
                  Offer donation
                </button>
              </form>
              {donorOffered && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">
                  Accepted as intended: Campus A still needs water. Donation accepted as intended.
                </div>
              )}
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === 'Reports' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-800">Decision log</h4>
                <button className="bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> Download CSV
                </button>
              </div>
              {logs.length === 0 ? (
                <p className="text-xs text-slate-400">No decisions recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {logs.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center gap-3">
                      <span className="text-slate-400 font-mono text-[11px]">{log.time}</span>
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                        {log.action}
                      </span>
                      <span className="font-semibold text-slate-800">{log.transfer}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

    </div>
  );
}