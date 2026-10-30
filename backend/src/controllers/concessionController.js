import Concession from '../models/Concession.js';

export const getConcessions = async (req, res) => {
  try {
    const rawConcessions = await Concession.find({}).sort({ price: 1 }).lean();
    const concessions = rawConcessions.map((c) => ({
      ...c,
      id: c._id.toString(),
    }));
    res.json(concessions);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh mục bắp nước', error: error.message });
  }
};
