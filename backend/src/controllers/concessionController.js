import prisma from '../prisma.js';

export const getConcessions = async (req, res) => {
  try {
    const concessions = await prisma.concession.findMany({
      orderBy: { price: 'asc' },
    });
    res.json(concessions);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy danh mục bắp nước', error: error.message });
  }
};

