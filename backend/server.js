

require("dotenv").config();

const path = require("node:path");
const {
  getQcStatus,
  isBlockingComponent
} = require("./utils/qcRules");
const express = require("express");

const cors = require("cors");

const cookieParser = require("cookie-parser");

const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

const { randomUUID } = require("node:crypto");

const { PrismaClient } = require("@prisma/client");



const {

  authenticate,

  authorizeRoles,

} = require("./middleware/authMiddleware");



const app = express();

const prisma = new PrismaClient();

const PORT = process.env.PORT || 5000;



// ==========================================

// 1. ENVIRONMENT SECURITY

// ==========================================



if (

  !process.env.JWT_SECRET ||

  process.env.JWT_SECRET.length < 32

) {

  throw new Error("A strong JWT_SECRET is required");

}



// ==========================================

// 2. EXPRESS MIDDLEWARE

// ==========================================



app.use(

  cors({

    origin: "http://localhost:5173",

    credentials: true,

  })

);



app.use(express.json({ limit: "100kb" }));

app.use(cookieParser());



// ==========================================

// 3. HEALTH CHECK

// ==========================================



app.get("/api/health", (req, res) => {

  return res.status(200).json({

    success: true,

    message: "ApparelFlow ERP Backend is running!",

  });

});



// ==========================================

// 4. LOGIN API

// ==========================================



app.post("/api/auth/login", async (req, res) => {

  try {

    const { email, password } = req.body || {};



    if (

      typeof email !== "string" ||

      typeof password !== "string" ||

      !email.trim() ||

      !password ||

      email.length > 254 ||

      password.length > 128

    ) {

      return res.status(400).json({

        success: false,

        message: "Valid email and password are required",

      });

    }



    const user = await prisma.user.findUnique({

      where: {

        email: email.trim().toLowerCase(),

      },

    });



    if (

      !user ||

      !(await bcrypt.compare(password, user.passwordHash))

    ) {

      return res.status(401).json({

        success: false,

        message: "Invalid email or password",

      });

    }



    const token = jwt.sign(

      {

        sub: String(user.id),

      },

      process.env.JWT_SECRET,

      {

        expiresIn: "2h",

        issuer: "apparelflow-erp",

      }

    );



    res.cookie("apparelflow_token", token, {

      httpOnly: true,

      secure: process.env.NODE_ENV === "production",

      sameSite: "lax",

      maxAge: 2 * 60 * 60 * 1000,

      path: "/",

    });



    return res.status(200).json({

      success: true,

      message: "Login successful",

      user: {

        id: user.id,

        fullName: user.fullName,

        email: user.email,

        role: user.role,

      },

    });



  } catch (error) {

    console.error("Login error:", error);



    return res.status(500).json({

      success: false,

      message: "Internal server error",

    });

  }

});



// ==========================================

// 5. CURRENT AUTHENTICATED USER

// ==========================================



app.get(

  "/api/auth/me",

  authenticate,

  (req, res) => {

    return res.status(200).json({

      success: true,

      user: req.user,

    });

  }

);



// ==========================================

// 6. LOGOUT API

// ==========================================



app.post("/api/auth/logout", (req, res) => {

  res.clearCookie("apparelflow_token", {

    httpOnly: true,

    secure: process.env.NODE_ENV === "production",

    sameSite: "lax",

    path: "/",

  });



  return res.status(200).json({

    success: true,

    message: "Logged out successfully",

  });

});



// ==========================================

// 7. GET PRODUCTION RECIPES

// Authentication Required

// ==========================================



app.get(

  "/api/recipes",

  authenticate,

  async (req, res) => {

    try {

      const recipes = await prisma.recipe.findMany({

        include: {

          components: true,

        },

        orderBy: {

          id: "asc",

        },

      });



      return res.status(200).json({

        success: true,

        count: recipes.length,

        data: recipes,

      });



    } catch (error) {

      console.error("Recipes error:", error);



      return res.status(500).json({

        success: false,

        message: "Failed to fetch recipes",

      });

    }

  }

);



// ==========================================

// 8. CREATE CUTTING ORDER

// Role: Cutting Supervisor Only

// ==========================================



app.post(

  "/api/cutting-orders",

  authenticate,

  authorizeRoles("cutting_supervisor"),

  async (req, res) => {

    try {

      const {

        recipeId,

        targetQty,

        fabricRollId,

        actualFabricYds,

      } = req.body || {};



      if (

        !Number.isSafeInteger(recipeId) ||

        recipeId <= 0

      ) {

        return res.status(400).json({

          success: false,

          message: "A valid recipe ID is required",

        });

      }



      if (

        !Number.isSafeInteger(targetQty) ||

        targetQty < 1 ||

        targetQty > 100000

      ) {

        return res.status(400).json({

          success: false,

          message:

            "Target quantity must be between 1 and 100000",

        });

      }



      if (

        typeof fabricRollId !== "string" ||

        !fabricRollId.trim() ||

        fabricRollId.trim().length > 80

      ) {

        return res.status(400).json({

          success: false,

          message: "A valid fabric roll ID is required",

        });

      }



      if (

        typeof actualFabricYds !== "number" ||

        !Number.isFinite(actualFabricYds) ||

        actualFabricYds <= 0 ||

        actualFabricYds > 10000000

      ) {

        return res.status(400).json({

          success: false,

          message:

            "Actual fabric yards must be a positive number",

        });

      }



      const recipe = await prisma.recipe.findUnique({

        where: {

          id: recipeId,

        },

        include: {

          components: true,

        },

      });



      if (!recipe) {

        return res.status(404).json({

          success: false,

          message: "Recipe not found",

        });

      }



      if (recipe.components.length === 0) {

        return res.status(422).json({

          success: false,

          message: "Recipe has no cutting components",

        });

      }



      // Expected = Pieces per garment x Target

      const verificationItems = recipe.components.map(

        (component) => ({

          componentId: component.id,

          expectedQty:

            component.piecesPerGarment * targetQty,

          actualQty: null,

        })

      );



      if (

        verificationItems.some(

          (item) =>

            !Number.isSafeInteger(item.expectedQty) ||

            item.expectedQty <= 0

        )

      ) {

        return res.status(422).json({

          success: false,

          message:

            "Invalid expected component quantities",

        });

      }



      const orderNo = `CUT-${randomUUID()}`;



      // Create the order and verification items

      // atomically using Prisma nested create

      const order = await prisma.cuttingOrder.create({

        data: {

          orderNo,

          recipeId: recipe.id,

          targetQty,

          fabricRollId: fabricRollId.trim(),

          actualFabricYds,

          status: "CUTTING_IN_PROGRESS",

          createdBy: req.user.id,



          verificationItems: {

            create: verificationItems,

          },

        },



        include: {

          recipe: true,

          verificationItems: {

            include: {

              component: true,

            },

          },

        },

      });



      return res.status(201).json({

        success: true,

        message: "Cutting order created successfully",

        data: order,

      });



    } catch (error) {

      console.error(

        "Create cutting order error:",

        error

      );



      return res.status(500).json({

        success: false,

        message: "Failed to create cutting order",

      });

    }

  }

);



// ==========================================

// 9. GET SAVED CUTTING ORDERS

// Role: Cutting Supervisor Only

// ==========================================



app.get(

  "/api/cutting-orders",

  authenticate,

  authorizeRoles("cutting_supervisor"),

  async (req, res) => {

    try {

      const orders = await prisma.cuttingOrder.findMany({

        where: {

          createdBy: req.user.id,

        },



        include: {

          recipe: true,

          verificationItems: {

            include: {

              component: true,

            },

          },

        },



        orderBy: {

          createdAt: "desc",

        },

      });



      return res.status(200).json({

        success: true,

        count: orders.length,

        data: orders,

      });



    } catch (error) {

      console.error(

        "Get cutting orders error:",

        error

      );



      return res.status(500).json({

        success: false,

        message: "Failed to load cutting orders",

      });

    }

  }

);



// ==========================================

// 10. SUBMIT ORDER FOR VERIFICATION

// Role: Cutting Supervisor Only

// ==========================================



app.patch(

  "/api/cutting-orders/:id/submit-verification",

  authenticate,

  authorizeRoles("cutting_supervisor"),

  async (req, res) => {

    try {

      const rawId = req.params.id;

      const orderId = Number(rawId);



      if (

        !/^[1-9]\d*$/.test(rawId) ||

        !Number.isSafeInteger(orderId)

      ) {

        return res.status(400).json({

          success: false,

          message: "Invalid cutting order ID",

        });

      }



      const existingOrder =

        await prisma.cuttingOrder.findUnique({

          where: {

            id: orderId,

          },

          select: {

            id: true,

            createdBy: true,

            status: true,

            verificationItems: {

              select: {

                id: true,

                expectedQty: true,

              },

            },

          },

        });



      if (!existingOrder) {

        return res.status(404).json({

          success: false,

          message: "Cutting order not found",

        });

      }



      if (existingOrder.createdBy !== req.user.id) {

        return res.status(403).json({

          success: false,

          message:

            "You cannot submit this cutting order",

        });

      }



      if (

        existingOrder.status !== "CUTTING_IN_PROGRESS"

      ) {

        return res.status(409).json({

          success: false,

          message:

            "Only orders in CUTTING_IN_PROGRESS can be submitted",

        });

      }



      if (

        existingOrder.verificationItems.length === 0 ||

        existingOrder.verificationItems.some(

          (item) =>

            !Number.isSafeInteger(item.expectedQty) ||

            item.expectedQty <= 0

        )

      ) {

        return res.status(422).json({

          success: false,

          message:

            "Order has invalid or missing expected components",

        });

      }



      // Conditional update prevents duplicate submissions

      const updated =

        await prisma.cuttingOrder.updateMany({

          where: {

            id: orderId,

            createdBy: req.user.id,

            status: "CUTTING_IN_PROGRESS",

          },

          data: {

            status: "PENDING_VERIFICATION",

          },

        });



      if (updated.count !== 1) {

        return res.status(409).json({

          success: false,

          message:

            "Order status changed. Refresh and try again.",

        });

      }



      const submittedOrder =

        await prisma.cuttingOrder.findUnique({

          where: {

            id: orderId,

          },

          include: {

            recipe: true,

            verificationItems: {

              include: {

                component: true,

              },

            },

          },

        });



      return res.status(200).json({

        success: true,

        message:

          "Cutting order submitted for verification",

        data: submittedOrder,

      });



    } catch (error) {

      console.error(

        "Submit verification error:",

        error

      );



      return res.status(500).json({

        success: false,

        message:

          "Failed to submit cutting order for verification",

      });

    }

  }

);



// ==========================================

// 11. GET CUTTING VERIFIER QUEUE

// Role: Cutting Verifier Only

// ==========================================



app.get(

  "/api/verifier/orders",

  authenticate,

  authorizeRoles("cutting_verifier"),

  async (req, res) => {

    try {

      const orders = await prisma.cuttingOrder.findMany({

        where: {

          status: "PENDING_VERIFICATION",

        },



        include: {

          recipe: true,

          verificationItems: {

            include: {

              component: true,

            },

            orderBy: {

              id: "asc",

            },

          },

        },



        orderBy: {

          createdAt: "desc",

        },

      });



      return res.status(200).json({

        success: true,

        count: orders.length,

        data: orders,

      });



    } catch (error) {

      console.error(

        "Verifier queue error:",

        error

      );



      return res.status(500).json({

        success: false,

        message: "Failed to load verification queue",

      });

    }

  }

);



// ==========================================

// 12. VERIFICATION DECISION API

// Role: Cutting Verifier Only

//

// GREEN = Actual equals expected

// YELLOW = Actual exceeds expected

// RED = Actual is below expected

// UNCOUNTED = Actual quantity missing

//

// RED or UNCOUNTED blocks approval: HTTP 422

// ==========================================



app.post(

  "/api/verifier/orders/:id/decision",

  authenticate,

  authorizeRoles("cutting_verifier"),

  async (req, res) => {



    function fail(

      status,

      message,

      blockingComponents

    ) {

      const error = new Error(message);

      error.httpStatus = status;

      error.blockingComponents = blockingComponents;

      throw error;

    }



    try {

      const rawId = req.params.id;

      const orderId = Number(rawId);



      const {

        decision,

        items,

        rejectionNote,

      } = req.body || {};



      // A. Validate order ID

      if (

        !/^[1-9]\d*$/.test(rawId) ||

        !Number.isSafeInteger(orderId)

      ) {

        fail(400, "Invalid cutting order ID");

      }



      // B. Validate decision

      if (

        decision !== "APPROVED" &&

        decision !== "REJECTED"

      ) {

        fail(

          400,

          "Decision must be APPROVED or REJECTED"

        );

      }



      // C. A rejection reason is mandatory

      if (

        decision === "REJECTED" &&

        (

          typeof rejectionNote !== "string" ||

          !rejectionNote.trim() ||

          rejectionNote.trim().length > 1000

        )

      ) {

        fail(

          422,

          "A rejection reason is required (maximum 1000 characters)"

        );

      }



      // D. Validate submitted count structure

      if (

        items !== undefined &&

        !Array.isArray(items)

      ) {

        fail(400, "Items must be an array");

      }



      const submittedItems = items || [];

      const actualCounts = new Map();



      for (const item of submittedItems) {

        if (

          !item ||

          !Number.isSafeInteger(item.verificationItemId) ||

          item.verificationItemId <= 0 ||

          !Number.isSafeInteger(item.actualQty) ||

          item.actualQty < 0

        ) {

          fail(

            422,

            "Actual quantities must be non-negative integers"

          );

        }



        if (

          actualCounts.has(item.verificationItemId)

        ) {

          fail(

            422,

            "Duplicate verification item IDs are not allowed"

          );

        }



        actualCounts.set(

          item.verificationItemId,

          item.actualQty

        );

      }



      // E. Load order from Neon database

      const order = await prisma.cuttingOrder.findUnique({

        where: {

          id: orderId,

        },



        include: {

          recipe: true,

          verificationItems: {

            include: {

              component: true,

            },

            orderBy: {

              id: "asc",

            },

          },

        },

      });



      if (!order) {

        fail(404, "Cutting order not found");

      }



      if (

        order.status !== "PENDING_VERIFICATION"

      ) {

        fail(

          409,

          "Only pending verification orders can be processed"

        );

      }



      if (order.verificationItems.length === 0) {

        fail(

          422,

          "Order contains no verification components"

        );

      }



      // F. Validate component ownership

      const validItemIds = new Set(

        order.verificationItems.map(

          (item) => item.id

        )

      );



      for (const itemId of actualCounts.keys()) {

        if (!validItemIds.has(itemId)) {

          fail(

            422,

            "A submitted component does not belong to this order"

          );

        }

      }



      // G. Calculate QC results

      const inspection = order.verificationItems.map(

        (item) => {

          const actualQty =

            actualCounts.has(item.id)

              ? actualCounts.get(item.id)

              : null;



          const status = getQcStatus(item.expectedQty, actualQty);



          return {

            verificationItemId: item.id,

            componentName:

              item.component.componentName,

            expectedQty: item.expectedQty,

            actualQty,

            variance:

              actualQty === null

                ? null

                : actualQty - item.expectedQty,

            status,

          };

        }

      );



      // H. BACKEND HARD STOP

      if (decision === "APPROVED") {

       const blockingComponents = inspection.filter(isBlockingComponent);



        if (blockingComponents.length > 0) {

          fail(

            422,

            "HARD STOP: Approval blocked because some components are missing or below expected quantity",

            blockingComponents

          );

        }

      }



      // I. Calculate estimated fabric overuse

      const standardFabric =

        order.recipe.stdFabricYards *

        order.targetQty;



      if (

        !Number.isFinite(standardFabric) ||

        standardFabric <= 0 ||

        !Number.isFinite(order.actualFabricYds) ||

        order.actualFabricYds <= 0

      ) {

        fail(

          422,

          "Invalid fabric quantity data"

        );

      }



      const wastagePct = Number(

        Math.max(

          0,

          (

            (order.actualFabricYds - standardFabric) /

            standardFabric

          ) * 100

        ).toFixed(2)

      );



      const nextStatus =

        decision === "APPROVED"

          ? "VERIFIED"

          : "REJECTED";



      // J. Atomic database transaction

      const audit = await prisma.$transaction(

        async (tx) => {



          // Ensure only pending orders transition

          const transition =

            await tx.cuttingOrder.updateMany({

              where: {

                id: orderId,

                status: "PENDING_VERIFICATION",

              },

              data: {

                status: nextStatus,

              },

            });



          if (transition.count !== 1) {

            fail(

              409,

              "Order was already processed. Refresh the queue."

            );

          }



          // Save component counts and QC colours

          for (const item of inspection) {

            if (item.actualQty === null) {

              continue;

            }



            await tx.verificationItem.update({

              where: {

                id: item.verificationItemId,

              },

              data: {

                actualQty: item.actualQty,

                status: item.status,

              },

            });

          }



          // Save audit log

          const verificationLog =

            await tx.verificationLog.create({

              data: {

                orderId,

                verifierId: req.user.id,

                decision,

                rejectionNote:

                  decision === "REJECTED"

                    ? rejectionNote.trim()

                    : null,

                wastagePct,

                timestamp: new Date(),

              },

            });



          return verificationLog;

        }

      );



      // K. Successful response

      return res.status(200).json({

        success: true,

        message:

          decision === "APPROVED"

            ? "Cutting order verified successfully"

            : "Cutting order rejected successfully",

        orderId,

        status: nextStatus,

        wastagePct,

        wastageCap: order.recipe.wastageCap,

        inspection,

        auditId: audit.id,

      });



    } catch (error) {

      if (error.httpStatus) {

        return res.status(error.httpStatus).json({

          success: false,

          message: error.message,

          ...(error.blockingComponents

            ? {

                blockingComponents:

                  error.blockingComponents,

              }

            : {}),

        });

      }



      console.error(

        "Verification decision error:",

        error

      );



      return res.status(500).json({

        success: false,

        message:

          "Failed to process verification decision",

      });

    }

  }

);





// ==========================================

// 14. VERIFICATION HISTORY

// Role: Cutting Verifier Only

// ==========================================



app.get(

  "/api/verifier/history",

  authenticate,

  authorizeRoles("cutting_verifier"),

  async (req, res) => {

    try {

      // Load audit logs for this verifier

      const logs = await prisma.verificationLog.findMany({

        where: {

          verifierId: req.user.id

        },

        orderBy: {

          timestamp: "desc"

        }

      });



      // Find associated production orders

      const orderIds = [

        ...new Set(logs.map((log) => log.orderId))

      ];



      const orders = orderIds.length

        ? await prisma.cuttingOrder.findMany({

            where: {

              id: {

                in: orderIds

              }

            },

            select: {

              id: true,

              orderNo: true,

              targetQty: true,

              status: true,

              recipe: {

                select: {

                  name: true,

                  recipeCode: true

                }

              }

            }

          })

        : [];



      const orderMap = new Map(

        orders.map((order) => [order.id, order])

      );



      const history = logs.map((log) => ({

        id: log.id,

        orderId: log.orderId,

        decision: log.decision,

        rejectionNote: log.rejectionNote,

        wastagePct: log.wastagePct,

        timestamp: log.timestamp,

        verifierId: log.verifierId,

        order: orderMap.get(log.orderId) || null

      }));



      return res.status(200).json({

        success: true,

        count: history.length,

        data: history

      });



    } catch (error) {

      console.error(

        "Verification history error:",

        error

      );



      return res.status(500).json({

        success: false,

        message: "Failed to load verification history"

      });

    }

  }

);





// ==========================================

// 15. VERIFIED SEWING QUEUE

// Role: Sewing Supervisor Only

// ==========================================



app.get(

  "/api/sewing/queue",

  authenticate,

  authorizeRoles("sewing_supervisor"),

  async (req, res) => {

    try {

      const orders = await prisma.cuttingOrder.findMany({

        where: {

          status: "VERIFIED"

        },



        include: {

          recipe: true,



          verificationItems: {

            include: {

              component: true

            },

            orderBy: {

              id: "asc"

            }

          }

        },



        orderBy: {

          updatedAt: "desc"

        }

      });



      return res.status(200).json({

        success: true,

        count: orders.length,

        data: orders

      });



    } catch (error) {

      console.error("Sewing queue error:", error);



      return res.status(500).json({

        success: false,

        message: "Failed to load verified sewing queue"

      });

    }

  }

);



// ==========================================

// 13. START EXPRESS SERVER

// ==========================================



// ==========================================

// STEP 5.2 - START SEWING

// Role: Sewing Supervisor Only

//

// Only VERIFIED batches with valid component

// counts and an approval record can start sewing.

// ==========================================



app.patch(

  "/api/sewing/orders/:id/start",

  authenticate,

  authorizeRoles("sewing_supervisor"),

  async (req, res) => {

    try {

      const rawId = req.params.id;

      const orderId = Number(rawId);



      // 1. Validate order ID

      if (

        !/^[1-9]\d*$/.test(rawId) ||

        !Number.isSafeInteger(orderId)

      ) {

        return res.status(400).json({

          success: false,

          message: "Invalid cutting order ID"

        });

      }



      // 2. Load order and verified component counts

      const order = await prisma.cuttingOrder.findUnique({

        where: {

          id: orderId

        },

        include: {

          recipe: true,

          verificationItems: true

        }

      });



      if (!order) {

        return res.status(404).json({

          success: false,

          message: "Cutting order not found"

        });

      }



      // 3. SECURITY GATE: verified orders only

      if (order.status !== "VERIFIED") {

        return res.status(409).json({

          success: false,

          message:

            "SEWING BLOCKED: Only VERIFIED batches can start sewing",

          currentStatus: order.status

        });

      }



      // 4. Check all component quantities

      const invalidComponents =

        order.verificationItems.filter((item) => {

          return (

            !Number.isSafeInteger(item.expectedQty) ||

            item.expectedQty <= 0 ||

            !Number.isSafeInteger(item.actualQty) ||

            item.actualQty < item.expectedQty ||

            !["GREEN", "YELLOW"].includes(item.status)

          );

        });



      if (

        order.verificationItems.length === 0 ||

        invalidComponents.length > 0

      ) {

        return res.status(422).json({

          success: false,

          message:

            "SEWING BLOCKED: Component verification is incomplete or a shortage exists"

        });

      }



      // 5. Ensure a verifier approved the batch

      const approval = await prisma.verificationLog.findFirst({

        where: {

          orderId,

          decision: "APPROVED"

        },

        orderBy: {

          timestamp: "desc"

        }

      });



      if (!approval) {

        return res.status(422).json({

          success: false,

          message:

            "SEWING BLOCKED: No approved verification record found"

        });

      }



      // 6. Atomic conditional status transition

      const updated = await prisma.cuttingOrder.updateMany({

        where: {

          id: orderId,

          status: "VERIFIED"

        },

        data: {

          status: "SEWING_IN_PROGRESS",

          // Store the actual moment this verified batch enters sewing.
          sewingStartedAt: new Date()

        }

      });



      if (updated.count !== 1) {

        return res.status(409).json({

          success: false,

          message:

            "Order status has changed. Refresh the sewing queue."

        });

      }



      // 7. Retrieve updated order

      const startedOrder =

        await prisma.cuttingOrder.findUnique({

          where: {

            id: orderId

          },

          include: {

            recipe: true

          }

        });



      return res.status(200).json({

        success: true,

        message: "Sewing started successfully",

        data: startedOrder

      });



    } catch (error) {

      console.error("Start sewing error:", error);



      return res.status(500).json({

        success: false,

        message: "Failed to start sewing"

      });

    }

  }

);



// ==========================================

// STEP 5.3 - ACTIVE SEWING OPERATIONS

// Paste BEFORE the existing app.listen(...)

// Role: Sewing Supervisor Only

// ==========================================



app.get(

  "/api/sewing/active",

  authenticate,

  authorizeRoles("sewing_supervisor"),

  async (req, res) => {

    try {

      const orders = await prisma.cuttingOrder.findMany({

        where: {

          status: "SEWING_IN_PROGRESS",

        },

        include: {

          recipe: true,

          verificationItems: {

            include: { component: true },

            orderBy: { id: "asc" },

          },

        },

        orderBy: { updatedAt: "desc" },

      });



      return res.status(200).json({

        success: true,

        count: orders.length,

        data: orders,

      });

    } catch (error) {

      console.error("Active sewing orders error:", error);

      return res.status(500).json({

        success: false,

        message: "Failed to load active sewing orders",

      });

    }

  }

);



// ==========================================

// STEP 5.5 - UPDATE SEWING PROGRESS

// Role: Sewing Supervisor Only

// ==========================================



app.patch(

  "/api/sewing/orders/:id/progress",

  authenticate,

  authorizeRoles("sewing_supervisor"),

  async (req, res) => {



    function fail(status, message) {

      const error = new Error(message);

      error.httpStatus = status;

      throw error;

    }



    try {

      const rawId = req.params.id;

      const orderId = Number(rawId);

      const { completedQty } = req.body || {};



      // 1. Validate order ID

      if (

        !/^[1-9]\d*$/.test(rawId) ||

        !Number.isSafeInteger(orderId)

      ) {

        fail(400, "Invalid order ID");

      }



      // 2. Validate completed quantity

      if (

        !Number.isSafeInteger(completedQty) ||

        completedQty < 0

      ) {

        fail(

          400,

          "Completed quantity must be a non-negative integer"

        );

      }



      // 3. Atomic transaction

      const result = await prisma.$transaction(

        async (tx) => {



          const order = await tx.cuttingOrder.findUnique({

            where: {

              id: orderId

            }

          });



          if (!order) {

            fail(404, "Cutting order not found");

          }



          // Only sewing batches can receive updates

          if (order.status !== "SEWING_IN_PROGRESS") {

            fail(

              409,

              "Progress can only be updated for batches in sewing"

            );

          }



          // Cannot exceed target quantity

          if (completedQty > order.targetQty) {

            fail(

              422,

              "Completed quantity cannot exceed target quantity"

            );

          }



          // Progress cannot decrease

          if (completedQty < order.completedQty) {

            fail(

              422,

              "Completed quantity cannot decrease"

            );

          }



          // Prevent duplicate updates

          if (completedQty === order.completedQty) {

            fail(

              409,

              "Completed quantity is unchanged"

            );

          }



          const isComplete =

            completedQty === order.targetQty;



          const previousQty = order.completedQty;



          // 4. Conditional update prevents

          // concurrent conflicting progress changes

          const updated = await tx.cuttingOrder.updateMany({

            where: {

              id: orderId,

              status: "SEWING_IN_PROGRESS",

              completedQty: previousQty

            },

            data: {

              completedQty,

              ...(isComplete

                ? {

                    status: "SEWING_COMPLETED",

                    sewingCompletedAt: new Date()

                  }

                : {})

            }

          });



          if (updated.count !== 1) {

            fail(

              409,

              "Sewing progress changed. Refresh and try again."

            );

          }



          // 5. Save progress history

          const log = await tx.sewingProgressLog.create({

            data: {

              orderId,

              supervisorId: req.user.id,

              previousQty,

              completedQty

            }

          });



          const updatedOrder =

            await tx.cuttingOrder.findUnique({

              where: {

                id: orderId

              },

              include: {

                recipe: true

              }

            });



          return {

            order: updatedOrder,

            log

          };

        }

      );



      // 6. Calculate percentage

      const progressPct = Number(

        (

          completedQty /

          result.order.targetQty *

          100

        ).toFixed(2)

      );



      return res.status(200).json({

        success: true,

        message:

          result.order.status === "SEWING_COMPLETED"

            ? "Sewing completed successfully"

            : "Sewing progress updated successfully",

        data: {

          orderId,

          targetQty: result.order.targetQty,

          completedQty,

          progressPct,

          status: result.order.status,

          sewingCompletedAt:

            result.order.sewingCompletedAt,

          progressLogId: result.log.id

        }

      });



    } catch (error) {

      if (error.httpStatus) {

        return res.status(error.httpStatus).json({

          success: false,

          message: error.message

        });

      }



      console.error(

        "Update sewing progress error:",

        error

      );



      return res.status(500).json({

        success: false,

        message: "Failed to update sewing progress"

      });

    }

  }

);



// ==========================================

// STEP 5.6 - PRODUCTION HISTORY

// Sewing Supervisor Only

// ==========================================



app.get(

  "/api/sewing/history",

  authenticate,

  authorizeRoles("sewing_supervisor"),

  async (req, res) => {

    try {

      const orders = await prisma.cuttingOrder.findMany({

        where: {

          status: "SEWING_COMPLETED"

        },



        select: {

          id: true,

          orderNo: true,

          targetQty: true,

          completedQty: true,

          status: true,

          fabricRollId: true,

          actualFabricYds: true,

          sewingStartedAt: true,

          sewingCompletedAt: true,



          recipe: {

            select: {

              name: true,

              recipeCode: true

            }

          },



          sewingProgressLogs: {

            select: {

              id: true,

              previousQty: true,

              completedQty: true,

              timestamp: true,



              supervisor: {

                select: {

                  fullName: true

                }

              }

            },



            orderBy: {

              timestamp: "asc"

            }

          }

        },



        orderBy: {

          sewingCompletedAt: "desc"

        }

      });



      const history = orders.map((order) => ({

        ...order,



        progressPct:

          order.targetQty > 0

            ? Number(

                (

                  (order.completedQty / order.targetQty) *

                  100

                ).toFixed(2)

              )

            : 0

      }));



      return res.status(200).json({

        success: true,

        count: history.length,

        data: history

      });



    } catch (error) {

      console.error(

        "Production history error:",

        error

      );



      return res.status(500).json({

        success: false,

        message: "Failed to load production history"

      });

    }

  }

);


/* ==========================================
   REACT PRODUCTION FRONTEND
   ========================================== */

const frontendDist = path.resolve(
  __dirname,
  "../frontend/dist"
);

// Serve built React assets
app.use(express.static(frontendDist));

// React SPA fallback (Express 5)
app.get("/{*splat}", (req, res, next) => {
  // Do not return React HTML for unknown APIs
  if (req.path === "/api" || req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: "API endpoint not found",
    });
  }

  res.sendFile(
    path.join(frontendDist, "index.html"),
    (error) => {
      if (error) next(error);
    }
  );
});


app.listen(PORT, () => {

  console.log(

    `Backend running on http://localhost:${PORT}`

  );

});
