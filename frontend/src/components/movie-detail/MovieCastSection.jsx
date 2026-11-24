import React from 'react';

// Bảng căn chỉnh tâm khuôn mặt vàng cho từng nghệ sĩ (object-position)
// Giúp khuôn mặt luôn nằm ngay chính giữa hình tròn, không bị cắt trán, mắt hay cằm
const ACTOR_POSITION_MAP = {
  // Mai
  'phuong-anh-dao': 'center 22%',
  'tuan-tran': 'center 18%',
  'tran-thanh': 'center 18%',
  'nsnd-viet-anh': 'center 18%',
  'hong-dao': 'center 20%',
  'uyen-an': 'center 20%',

  // Cô Dâu Hào Môn
  'thu-trang': 'center 20%',
  'kieu-minh-tuan': 'center 20%',
  'le-giang': 'center 22%',
  'samuel-an': 'center 20%',
  'nsnd-hong-van': 'center 18%',

  // Lật Mặt 7: Một Điều Ước
  'thanh-hien': 'center 20%',
  'truong-minh-cuong': 'center 18%',
  'dinh-y-nhung': 'center 22%',
  'quach-ngoc-tuyen': 'center 20%',
  'tram-anh': 'center 22%',
  'tran-kim-hai': 'center 20%',
  'ly-hai': 'center 16%',

  // Quật Mộ Trùng Ma (Exhuma)
  'choi-min-sik': 'center 20%',
  'kim-go-eun': 'center 20%',
  'lee-do-hyun': 'center 20%',
  'yoo-hae-jin': 'center 20%',
  'kim-sun-young': 'center 20%',
  'jeon-jin-ki': 'center 20%',

  // Dune 2
  'timothee-chalamet': 'center 20%',
  'zendaya': 'center 18%',
  'austin-butler': 'center 18%',
  'rebecca-ferguson': 'center 20%',
  'florence-pugh': 'center 20%',
  'javier-bardem': 'center 20%',

  // Oppenheimer
  'cillian-murphy': 'center 22%',
  'emily-blunt': 'center 20%',
  'robert-downey-jr': 'center 20%',
  'matt-damon': 'center 20%',
  'rami-malek': 'center 20%',

  // Deadpool & Wolverine
  'ryan-reynolds': 'center 20%',
  'hugh-jackman': 'center 20%',
  'emma-corrin': 'center 20%',
  'matthew-macfadyen': 'center 20%',
  'dafne-keen': 'center 20%',
  'morena-baccarin': 'center 20%',

  // Spider-Man
  'tom-holland': 'center 20%',
  'benedict-cumberbatch': 'center 20%',
  'willem-dafoe': 'center 20%',
  'alfred-molina': 'center 20%',
  'jacob-batalon': 'center 20%',

  // Godzilla x Kong
  'rebecca-hall': 'center 20%',
  'brian-tyree-henry': 'center 20%',
  'dan-stevens': 'center 20%',
  'kaylee-hottle': 'center 20%',
  'alex-ferns': 'center 20%',
  'fala-chen': 'center 20%',

  // Venom
  'tom-hardy': 'center 20%',
  'chiwetel-ejiofor': 'center 20%',
  'juno-temple': 'center 20%',
  'rhys-ifans': 'center 20%',
  'stephen-graham': 'center 20%',
  'peggy-lu': 'center 20%',
};

const getActorPosition = (actor) => {
  if (actor?.avatar) {
    const filename = actor.avatar.split('/').pop().replace(/\.[^.]+$/, '');
    if (ACTOR_POSITION_MAP[filename]) return ACTOR_POSITION_MAP[filename];
  }
  return 'center 20%';
};

const MovieCastSection = ({ cast }) => {
  const castList = Array.isArray(cast) ? cast : [];

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--border-default)]/80 pb-3">
        <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider border-l-4 border-[var(--cyan)] pl-3">
          Dàn diễn viên & Nhân vật
        </h3>
        <span className="text-xs text-slate-400 font-semibold">
          {castList.length > 0 ? `${castList.length} diễn viên chủ chốt` : 'Diễn viên chủ chốt'}
        </span>
      </div>

      {/* Danh sách ảnh tròn của diễn viên - Căn chuẩn tâm mặt, rõ nét, cân xứng */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-5 sm:gap-6">
        {castList.length > 0 ? (
          castList.slice(0, 6).map((actor, idx) => (
            <div key={idx} className="flex flex-col items-center text-center space-y-2.5 group/actor">
              <div className="w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-slate-700/80 group-hover/actor:border-[var(--cyan)] ring-2 ring-slate-800/60 group-hover/actor:ring-[var(--cyan)]/40 transition-all duration-300 shadow-xl bg-gradient-to-b from-slate-700/70 via-slate-800 to-slate-950 flex-shrink-0">
                <img
                  src={
                    actor.avatar ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop'
                  }
                  alt={actor.name}
                  style={{ objectPosition: getActorPosition(actor) }}
                  className="w-full h-full object-cover group-hover/actor:scale-108 transition-transform duration-300 ease-out"
                  onError={(e) => {
                    e.target.src =
                      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop';
                  }}
                />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs sm:text-sm font-bold text-white group-hover/actor:text-[var(--cyan)] transition-colors line-clamp-1">
                  {actor.name}
                </h4>
                <p className="text-[11px] text-slate-400 font-medium line-clamp-1">{actor.role}</p>
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
