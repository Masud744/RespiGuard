import React from 'react';

export default function ClinicalAlerts({ alerts, onViewAll }) {
  const professionals = alerts || [
    {
      id: 1,
      doctor: "Dr. Willow Zephyr",
      specialty: "Orthopedic Specialist",
      patient_count: "234 Patients",
      avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&auto=format&fit=crop&q=80"
    },
    {
      id: 2,
      doctor: "Dr. Hazel Quinn",
      specialty: "Surgeon",
      patient_count: "226 Patients",
      avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&auto=format&fit=crop&q=80"
    },
    {
      id: 3,
      doctor: "Dr. River Wilde",
      specialty: "Gynecologist",
      patient_count: "208 Patients",
      avatar: "https://images.unsplash.com/photo-1594824813590-349f506e3a6c?w=120&auto=format&fit=crop&q=80"
    }
  ];

  return (
    <div className="aura-card p-5 flex flex-col justify-between h-[230px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Recent Professionals</h3>
        <button 
          onClick={onViewAll}
          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition"
        >
          View All
        </button>
      </div>

      {/* List items matching reference image */}
      <div className="space-y-3 mt-2">
        {professionals.slice(0, 3).map((item) => (
          <div key={item.id} className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <img
                src={item.avatar}
                alt={item.doctor}
                className="w-8 h-8 rounded-full object-cover border border-emerald-500/30 group-hover:border-emerald-400 transition"
              />
              <div>
                <p className="text-xs font-semibold text-white group-hover:text-emerald-300 transition">
                  {item.doctor}
                </p>
                <p className="text-[11px] text-slate-400">
                  {item.specialty}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-slate-400">
              {item.patient_count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
