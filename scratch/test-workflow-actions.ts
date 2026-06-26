import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const { validatePrintEligibility, confirmPrint, requestReprint, blockBadge, unblockBadge, getEmployeePrintHistory } = await import('../app/actions/employees');
  const { prisma } = await import('../lib/prisma');

  // Let's find the first employee with status 'PHOTO_VALIDEE'
  const emp = await prisma.employee.findFirst({
    where: { status: 'PHOTO_VALIDEE' },
    include: { company: true }
  });

  if (!emp) {
    console.log("No employee with PHOTO_VALIDEE status found. Cannot run test.");
    return;
  }

  const empId = emp.id;
  console.log(`Starting test for employee: ${emp.uniqueIdentifier} (ID: ${empId}), Status: ${emp.status}, Company: ${emp.company.name}`);

  // Test 1: validatePrintEligibility
  console.log("\n--- TEST 1: validatePrintEligibility ---");
  const eligibility = await validatePrintEligibility([empId]);
  console.log("Eligibility result:", JSON.stringify(eligibility, null, 2));

  if (eligibility.eligible.length === 0) {
    console.error("Employee is not eligible for printing!");
    return;
  }

  // Test 2: confirmPrint
  console.log("\n--- TEST 2: confirmPrint ---");
  try {
    const printResult = await confirmPrint([empId], 'BADGE');
    console.log("Print confirmation result:", JSON.stringify(printResult, null, 2));

    const updatedEmp = await prisma.employee.findUnique({ where: { id: empId } });
    console.log("Employee after print:", {
      status: updatedEmp?.status,
      cardNumber: updatedEmp?.cardNumber,
      isLocked: updatedEmp?.isLocked,
      printCount: updatedEmp?.printCount
    });
  } catch (error) {
    console.error("confirmPrint failed:", error);
    return;
  }

  // Test 3: Modify employee data when locked (should fail / throw warning in update action)
  console.log("\n--- TEST 3: Trying to update locked employee data (actions test) ---");
  const { updateEmployeeData } = await import('../app/actions/employees');
  try {
    // Let's see if updateEmployeeData throws/reverts
    const updateResult = await updateEmployeeData(empId, { uniqueIdentifier: "TEST_MOD" });
    console.log("Update result (unexpected success):", updateResult);
  } catch (error: any) {
    console.log("Update failed as expected! Error:", error.message);
  }

  // Test 4: requestReprint
  console.log("\n--- TEST 4: requestReprint ---");
  try {
    const reprintReason = "Badge cassé / perdu";
    const reprintResult = await requestReprint(empId, reprintReason, 'BADGE');
    console.log("Reprint request result:", {
      status: reprintResult.status,
      isLocked: reprintResult.isLocked
    });

    const jobs = await getEmployeePrintHistory(empId);
    console.log("Last Print Job (should be PENDING reprint):", jobs[0]);
  } catch (error) {
    console.error("requestReprint failed:", error);
    return;
  }

  // Test 5: confirmPrint again (Reprint)
  console.log("\n--- TEST 5: confirmPrint (reprint) ---");
  try {
    const reprintConfirmResult = await confirmPrint([empId], 'BADGE');
    console.log("Reprint confirmation result:", {
      printedCount: reprintConfirmResult.printed.length,
      cardNumber: reprintConfirmResult.printed[0]?.cardNumber,
      printCount: reprintConfirmResult.printed[0]?.printCount,
      isLocked: reprintConfirmResult.printed[0]?.isLocked,
      status: reprintConfirmResult.printed[0]?.status
    });

    const jobs = await getEmployeePrintHistory(empId);
    console.log("Print jobs after reprint:", jobs.map(j => ({
      cardNumber: j.cardNumber,
      templateType: j.templateType,
      isReprint: j.isReprint,
      reprintReason: j.reprintReason
    })));
  } catch (error) {
    console.error("confirmPrint (reprint) failed:", error);
    return;
  }

  // Test 6: blockBadge (Mock ADMIN session)
  console.log("\n--- TEST 6: blockBadge & unblockBadge ---");
  try {
    // Note: session user role is checked. If running in script, getServerSession might return null or mock.
    // Let's see if we get an authorization error, which is expected since we don't have an active session in tsx context.
    console.log("Calling blockBadge...");
    const blockResult = await blockBadge(empId);
    console.log("Block badge result:", blockResult);
  } catch (error: any) {
    console.log("Block badge failed/reverted (expected if no Admin session):", error.message);
  }

  // Let's cleanup this employee's state back to PHOTO_VALIDEE for normal operation
  console.log("\n--- CLEANUP: Resetting employee to PHOTO_VALIDEE for manual testing ---");
  await prisma.printJob.deleteMany({ where: { employeeId: empId } });
  const cleanedEmp = await prisma.employee.update({
    where: { id: empId },
    data: {
      status: 'PHOTO_VALIDEE',
      cardNumber: null,
      isLocked: false,
      printCount: 0,
      printedAt: null,
      printedBy: null
    }
  });
  console.log("Reset complete! Status:", cleanedEmp.status);
}

main().catch(console.error);
