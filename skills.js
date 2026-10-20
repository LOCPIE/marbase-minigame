const RARITY_CONFIG = {
  legendary: {
    name: 'Huyền Thoại',
    icon: '🌟',
    color: '#fbbf24',
    border: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.18)',
    dropRate: '6%',
    badgeClass: 'rarity-legendary'
  },
  epic: {
    name: 'Sử Thi',
    icon: '🔮',
    color: '#c084fc',
    border: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.18)',
    dropRate: '18%',
    badgeClass: 'rarity-epic'
  },
  rare: {
    name: 'Hiếm',
    icon: '🔷',
    color: '#38bdf8',
    border: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.18)',
    dropRate: '34%',
    badgeClass: 'rarity-rare'
  },
  common: {
    name: 'Phổ Thông',
    icon: '🟢',
    color: '#34d399',
    border: '#10b981',
    bg: 'rgba(16, 185, 129, 0.18)',
    dropRate: '42%',
    badgeClass: 'rarity-common'
  }
};

const RARITY_WEIGHTS = {
  legendary: 6,
  epic: 18,
  rare: 34,
  common: 42
};

const SKILLS = [
  // ==================== HUYỀN THOẠI (LEGENDARY - 6%) ====================
  {
    id: 'SWAP_TOP1',
    name: 'Hoán Đổi Càn Khôn',
    icon: '🔄',
    desc: 'Hoán đổi toàn bộ điểm số của bạn với người Top 1! (Nếu đang Top 1 sẽ đổi ra ngẫu nhiên 1 kỹ năng khác)',
    type: 'instant',
    target: 'top1',
    sound: 'swap',
    rarity: 'legendary',
    rarityName: 'Huyền Thoại',
    rarityColor: '#fbbf24'
  },
  {
    id: 'SILENCE_TOP3',
    name: 'Cấm Ngôn Tam Kiệt',
    icon: '🤫',
    desc: 'Khóa quyền trả lời của 3 người đang đứng top đầu trong 2 câu tiếp theo!',
    type: 'attack',
    target: 'top3',
    duration: 2,
    sound: 'silence',
    rarity: 'legendary',
    rarityName: 'Huyền Thoại',
    rarityColor: '#fbbf24'
  },
  {
    id: 'AUTO_CORRECT',
    name: 'Đổi Mệnh Thiên Cơ',
    icon: '🔀',
    desc: 'Tự động ăn trọn 100 điểm tuyệt đối ở câu hỏi tiếp theo mà không cần động não!',
    type: 'buff',
    duration: 1,
    sound: 'divine',
    rarity: 'legendary',
    rarityName: 'Huyền Thoại',
    rarityColor: '#fbbf24'
  },

  // ==================== SỬ THI (EPIC - 18%) ====================
  {
    id: 'DIVINE_SHIELD',
    name: 'Khiên Thần Thánh',
    icon: '🛡️',
    desc: 'Miễn nhiễm mọi kỹ năng hại, bom hoặc trừ điểm từ người khác trong 3 câu tiếp theo.',
    type: 'buff',
    duration: 3,
    sound: 'shield',
    rarity: 'epic',
    rarityName: 'Sử Thi',
    rarityColor: '#c084fc'
  },
  {
    id: 'STEAL_30',
    name: 'Bàn Tay Đạo Tặc',
    icon: '🦹',
    desc: 'Hút ngay 30% số điểm của 1 đối thủ chỉ định chuyển về cho bạn (tối đa 100đ)!',
    type: 'instant',
    target: 'choose_one',
    sound: 'steal',
    rarity: 'epic',
    rarityName: 'Sử Thi',
    rarityColor: '#c084fc'
  },
  {
    id: 'REFLECT_MIRROR',
    name: 'Gương Phản Chiếu',
    icon: '🪞',
    desc: 'Trong 3 câu tiếp theo, bất kỳ ai dùng kỹ năng hại bạn sẽ bị dội ngược lại chính họ!',
    type: 'buff',
    duration: 3,
    sound: 'reflect',
    rarity: 'epic',
    rarityName: 'Sử Thi',
    rarityColor: '#c084fc'
  },
  {
    id: 'EARTHQUAKE',
    name: 'Đại Địa Chấn',
    icon: '💥',
    desc: 'Trừ 25 điểm của TẤT CẢ đối thủ khác trong phòng và làm rung màn hình toàn phòng chơi!',
    type: 'attack',
    target: 'all_others',
    sound: 'earthquake',
    rarity: 'epic',
    rarityName: 'Sử Thi',
    rarityColor: '#c084fc'
  },
  {
    id: 'TIME_BOMB',
    name: 'Bom Hẹn Giờ',
    icon: '💣',
    desc: 'Gài bom vào đối thủ. Nếu câu tới họ trả lời sai hoặc hết giờ, nổ trừ 120 điểm!',
    type: 'attack',
    target: 'choose_one',
    duration: 1,
    sound: 'bomb',
    rarity: 'epic',
    rarityName: 'Sử Thi',
    rarityColor: '#c084fc'
  },

  // ==================== HIẾM (RARE - 34%) ====================
  {
    id: 'FREEZE_ONE',
    name: 'Đóng Băng Thời Gian',
    icon: '❄️',
    desc: 'Đóng băng 1 đối thủ trong câu tiếp theo, khiến họ không thể bấm đáp án.',
    type: 'attack',
    target: 'choose_one',
    duration: 1,
    sound: 'freeze',
    rarity: 'rare',
    rarityName: 'Hiếm',
    rarityColor: '#38bdf8'
  },
  {
    id: 'BOOST_50',
    name: 'Gia Tốc Hoàng Kim',
    icon: '⚡',
    desc: '+50% số điểm nhận được trong 3 câu hỏi tiếp theo.',
    type: 'buff',
    duration: 3,
    sound: 'buff',
    rarity: 'rare',
    rarityName: 'Hiếm',
    rarityColor: '#38bdf8'
  },
  {
    id: 'LUCKY_BOX',
    name: 'Hộp Quà Thần Bí',
    icon: '🎁',
    desc: 'Hên xui may rủi: Ngẫu nhiên +150 điểm, hoặc 2 nộ, hoặc nhận ngay Khiên Thần!',
    type: 'instant',
    target: 'self',
    sound: 'box',
    rarity: 'rare',
    rarityName: 'Hiếm',
    rarityColor: '#38bdf8'
  },
  {
    id: 'POINT_MAGNET',
    name: 'Nam Châm Hút Điểm',
    icon: '🧲',
    desc: 'Trong 2 câu tiếp theo, bạn được chia 25% số điểm mà người Top 1 kiếm được!',
    type: 'buff',
    duration: 2,
    sound: 'magnet',
    rarity: 'rare',
    rarityName: 'Hiếm',
    rarityColor: '#38bdf8'
  },
  {
    id: 'SPY_TOP1',
    name: 'Kính Nhìn Trộm Top 1',
    icon: '🎭',
    desc: 'Trong 2 câu tiếp theo, bạn nhìn thấy ngay đáp án mà người Top 1 vừa bấm chọn!',
    type: 'buff',
    duration: 2,
    sound: 'spy',
    rarity: 'rare',
    rarityName: 'Hiếm',
    rarityColor: '#38bdf8'
  },
  {
    id: 'DOUBLE_OR_NOTHING',
    name: 'Cược Mạng Nhân Đôi',
    icon: '🎲',
    desc: 'Câu tiếp theo: Đúng nhận x2 điểm (tối đa 200đ), sai bị trừ 50 điểm!',
    type: 'buff',
    duration: 1,
    sound: 'gamble',
    rarity: 'rare',
    rarityName: 'Hiếm',
    rarityColor: '#38bdf8'
  },

  // ==================== PHỔ THÔNG (COMMON - 42%) ====================
  {
    id: 'EAGLE_5050',
    name: 'Mắt Đại Bàng 50/50',
    icon: '🎯',
    desc: 'Lập tức loại bỏ 2 phương án sai trong câu hỏi tiếp theo, chỉ còn 2 lựa chọn!',
    type: 'buff',
    duration: 1,
    sound: 'radar',
    rarity: 'common',
    rarityName: 'Phổ Thông',
    rarityColor: '#34d399'
  },
  {
    id: 'TIME_WARP',
    name: 'Bẻ Cong Thời Gian',
    icon: '⏳',
    desc: 'Tặng riêng bạn thêm 15 giây đếm ngược trong câu tiếp theo!',
    type: 'buff',
    duration: 1,
    sound: 'timewarp',
    rarity: 'common',
    rarityName: 'Phổ Thông',
    rarityColor: '#34d399'
  },
  {
    id: 'INK_BLIND',
    name: 'Mực Bạch Tuộc',
    icon: '🐙',
    desc: 'Phun mực đen che kín màn hình 1 đối thủ. Họ phải lấy tay lau mực mới đọc được đề!',
    type: 'attack',
    target: 'choose_one',
    duration: 1,
    sound: 'ink',
    rarity: 'common',
    rarityName: 'Phổ Thông',
    rarityColor: '#34d399'
  },
  {
    id: 'SCREEN_SHAKE',
    name: 'Cơn Lốc Đảo Điên',
    icon: '🌪️',
    desc: 'Màn hình đối thủ bị đảo ngược 180 độ và rung giật liên tục trong 10s đầu câu hỏi!',
    type: 'attack',
    target: 'choose_one',
    duration: 1,
    sound: 'tornado',
    rarity: 'common',
    rarityName: 'Phổ Thông',
    rarityColor: '#34d399'
  },
  {
    id: 'SCRAMBLE_KEYS',
    name: 'Lú Lẫn Phím Bấm',
    icon: '🌀',
    desc: 'Xáo trộn ngẫu nhiên vị trí các nút A, B, C, D của đối thủ khiến họ dễ bấm nhầm!',
    type: 'attack',
    target: 'choose_one',
    duration: 1,
    sound: 'scramble',
    rarity: 'common',
    rarityName: 'Phổ Thông',
    rarityColor: '#34d399'
  },
  {
    id: 'FURY_SACRIFICE',
    name: 'Hiến Tế Bốc Kỹ Năng',
    icon: '🩸',
    desc: 'Tự trừ 30 điểm của mình để lập tức bốc ngẫu nhiên thêm 2 kỹ năng mới!',
    type: 'instant',
    target: 'self',
    sound: 'sacrifice',
    rarity: 'common',
    rarityName: 'Phổ Thông',
    rarityColor: '#34d399'
  }
];

module.exports = {
  SKILLS,
  RARITY_CONFIG,
  RARITY_WEIGHTS
};
