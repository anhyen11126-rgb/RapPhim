import React from 'react';

const MovieCastSection = ({ cast }) => {
  const castList = Array.isArray(cast) ? cast : [];

  return (
    <div className="bg-[#101625] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider border-l-4 border-blue-500 pl-3">
          Dàn diễn viên & Nhân vật
        </h3>
        <span className="text-xs text-slate-400 font-semibold">
          {castList.length > 0 ? `${castList.length} diễn viên chủ chốt` : 'Diễn viên chủ chốt'}
        </span>
      </div>

      {/* Danh sách ảnh tròn của diễn viên */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {castList.length > 0 ? (
          castList.slice(0, 6).map((actor, idx) => (
            <div key={idx} className="flex flex-col items-center text-center space-y-2 group/actor">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden border-2 border-slate-700 group-hover/actor:border-blue-500 transition-colors shadow-lg bg-slate-800">
                <img
                  src={
                    actor.avatar ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop'
                  }
                  alt={actor.name}
                  className="w-full h-full object-cover group-hover/actor:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    e.target.src =
                      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop';
                  }}
                />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white group-hover/actor:text-blue-400 transition-colors line-clamp-1">
                  {actor.name}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{actor.role}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-400 italic">Đang cập nhật danh sách diễn viên...</p>
        )}
      </div>
    </div>
  );
};

export default MovieCastSection;

