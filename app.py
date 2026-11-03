import streamlit as st
import pandas as pd
import datetime

# Page Configuration
st.set_page_config(page_title="ResQFlow Engine", layout="wide", page_icon="🛡️")

# Title & Header
st.title("🛡️ ResQFlow Engine")
st.caption("Explainable, Predictive Emergency Logistics & Relief Coordination — AICTE IDEA Lab Ideathon 2026")

# 1. ENGINE MODE SWITCHER & DISASTER PRESETS
col_mode, col_preset = st.columns([2, 2])

with col_mode:
    engine_mode = st.radio(
        "Select Operating Mode:",
        ["ResQFlow (Predictive Engine)", "Traditional (Manual Chaos)"],
        horizontal=True
    )

with col_preset:
    preset = st.selectbox(
        "Load Real-World Incident Preset:",
        ["Default Baseline", "Wayanad 2024 Landslides (Bridge Collapse)", "Multi-Camp Urgent Deficit"]
    )

# 2. STATE INITIALIZATION BASED ON PRESET
if preset == "Wayanad 2024 Landslides (Bridge Collapse)":
    camps = {
        'Chooralmala Camp (Camp A)': {'water_stock': 80, 'water_rate': 30, 'water_reserve': 50, 'med_stock': 80, 'med_rate': 1, 'med_reserve': 20},
        'Kalpetta Main Hub (Camp B)': {'water_stock': 2500, 'water_rate': 20, 'water_reserve': 300, 'med_stock': 200, 'med_rate': 2, 'med_reserve': 30},
        'Mundakkai Shelter (Camp C)': {'water_stock': 600, 'water_rate': 15, 'water_reserve': 150, 'med_stock': 15, 'med_rate': 4, 'med_reserve': 20}
    }
    road_ab_blocked = True
elif preset == "Multi-Camp Urgent Deficit":
    camps = {
        'Camp A (North)': {'water_stock': 60, 'water_rate': 20, 'water_reserve': 50, 'med_stock': 100, 'med_rate': 1, 'med_reserve': 20},
        'Camp B (Central Hub)': {'water_stock': 3000, 'water_rate': 25, 'water_reserve': 400, 'med_stock': 250, 'med_rate': 2, 'med_reserve': 50},
        'Camp C (South)': {'water_stock': 1500, 'water_rate': 15, 'water_reserve': 200, 'med_stock': 10, 'med_rate': 5, 'med_reserve': 20}
    }
    road_ab_blocked = False
else:
    camps = {
        'Camp A': {'water_stock': 150, 'water_rate': 25, 'water_reserve': 50, 'med_stock': 100, 'med_rate': 1, 'med_reserve': 20},
        'Camp B': {'water_stock': 1800, 'water_rate': 20, 'water_reserve': 300, 'med_stock': 150, 'med_rate': 2, 'med_reserve': 30},
        'Camp C': {'water_stock': 1200, 'water_rate': 15, 'water_reserve': 200, 'med_stock': 40, 'med_rate': 5, 'med_reserve': 20}
    }
    road_ab_blocked = False

st.markdown("---")

# 3. METRIC COMPARISON BANNER
m1, m2, m3, m4 = st.columns(4)

if engine_mode == "Traditional (Manual Chaos)":
    m1.metric("Shortage Lead Time", "0 Hours", "-100% (Reactive)", delta_color="inverse")
    m2.metric("Coordinator Lag", "14 Hours", "+14h Phone/Paper", delta_color="inverse")
    m3.metric("Stock Wastage", "~35% Excess", "Unused Surplus", delta_color="inverse")
    m4.metric("Road Obstruction Risk", "HIGH", "Unchecked Routing", delta_color="inverse")
else:
    m1.metric("Shortage Lead Time", "6.0 Hours", "+6h Proactive Warning")
    m2.metric("Coordinator Lag", "< 15 Secs", "1-Click Approval")
    m3.metric("Stock Wastage", "0%", "Smart Redirection Enabled")
    m4.metric("Road Obstruction Risk", "MINIMAL", "Dynamic Auto-Reroute")

st.markdown("---")

# 4. MAIN LAYOUT: CAMPS STATUS & RECOMMENDATION ENGINE
left_col, right_col = st.columns([1.2, 1.8])

with left_col:
    st.subheader("📋 Camp Inventory & Lead Time")
    
    # Interactive Landslide Toggle
    landslide_toggle = st.checkbox("🚧 Block Direct Route A-B (Landslide/Collapse)", value=road_ab_blocked)
    
    for name, data in camps.items():
        water_hours = (data['water_stock'] - data['water_reserve']) / data['water_rate']
        med_hours = (data['med_stock'] - data['med_reserve']) / data['med_rate']
        
        status_color = "red" if (water_hours < 10 or med_hours < 8) else "green"
        
        with st.expander(f"📍 {name}", expanded=True):
            st.write(f"**Water Stock:** {data['water_stock']} L | **Reserve:** {data['water_reserve']} L")
            if water_hours < 10:
                st.error(f"⚠️ Water empty in {water_hours:.1f} hours!")
            else:
                st.info(f"✅ Water safe for {water_hours:.1f} hours")
                
            st.write(f"**Medicine Stock:** {data['med_stock']} units | **Reserve:** {data['med_reserve']}")
            if med_hours < 8:
                st.error(f"⚠️ Medicine empty in {med_hours:.1f} hours!")
            else:
                st.info(f"✅ Medicine safe for {med_hours:.1f} hours")

with right_col:
    st.subheader("💡 Explainable AI Decision Cards")
    
    if engine_mode == "Traditional (Manual Chaos)":
        st.warning("⚠️ **Traditional System Active:** No predictive recommendations available. Coordination relies on manual phone calls after emergency stockouts occur.")
    else:
        # Recommendation Engine Calculations
        recs = []
        for target_name, target_data in camps.items():
            w_hrs = (target_data['water_stock'] - target_data['water_reserve']) / target_data['water_rate']
            
            if w_hrs < 10:
                for src_name, src_data in camps.items():
                    if src_name != target_name:
                        surplus = src_data['water_stock'] - src_data['water_reserve']
                        if surplus > 200:
                            route_status = "BLOCKED via Landslide! Detouring around valley..." if landslide_toggle and ("Camp A" in target_name or "Chooralmala" in target_name) else "DIRECT ROUTE OPEN"
                            
                            recs.append({
                                'target': target_name,
                                'source': src_name,
                                'type': 'Water',
                                'amount': min(surplus, 1000),
                                'hours': f"{w_hrs:.1f}",
                                'route': route_status,
                                'reason': f"{target_name} water will run out in {w_hrs:.1f} hours. {src_name} holds {surplus}L surplus above safety threshold."
                            })

        if not recs:
            st.success("🎉 All camp inventories are currently within safe operating thresholds.")
        else:
            for i, r in enumerate(recs):
                st.error(f"🚨 **CRITICAL TRANSFER REQUIRED (#{i+1})**")
                st.write(f"**Action:** Send **{r['amount']} L {r['type']}** from `{r['source']}` ➔ `{r['target']}`")
                
                # Rationale Box
                st.info(f"🧠 **Why This Transfer?**\n\n{r['reason']}\n\n**Route Verification:** {r['route']}")
                
                b1, b2 = st.columns(2)
                with b1:
                    if st.button(f"✅ Approve Transfer #{i+1}", key=f"app_{i}"):
                        st.success(f"Transfer #{i+1} Approved & Dispatched via Tanker 1!")
                with b2:
                    if st.button(f"❌ Decline", key=f"dec_{i}"):
                        st.info("Recommendation declined by coordinator.")

st.markdown("---")

# 5. OFFLINE SMS & DONOR REDIRECTION SIMULATION
col_sms, col_donor = st.columns(2)

with col_sms:
    st.subheader("📱 Low-Connectivity SMS Gateway")
    st.caption("Field officers can send stock updates via SMS when internet fails.")
    sms_cmd = st.text_input("Simulate Shortcode SMS:", value="STOCK CAMP_B WATER 2000")
    if st.button("Send SMS Update"):
        st.success(f"SMS Command Received: '{sms_cmd}'. Camp inventory updated successfully.")

with col_donor:
    st.subheader("🎁 Donor Smart Redirection Engine")
    donor_item = st.selectbox("Donor Offering:", ["Bottled Water", "Pediatric Medicine"])
    donor_camp = st.selectbox("Target Relief Camp:", list(camps.keys()))
    
    if st.button("Submit Donation"):
        if donor_item == "Bottled Water" and "Camp B" in donor_camp:
            st.warning("⚠️ **Smart Redirection Triggered:** Camp B already has 100+ hours of excess water. Your donation has been redirected to Camp C for urgent medicine!")
        else:
            st.success("Thank you! Donation accepted as requested.")