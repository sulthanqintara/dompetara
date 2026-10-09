import { getTranslations } from "next-intl/server";
import { Table } from "@/components/ui/table";
import { TableHeader } from "@/components/ui/table-header";
import { TableBody } from "@/components/ui/table-body";
import { TableRow } from "@/components/ui/table-row";
import { TableHead } from "@/components/ui/table-head";
import { TableCell } from "@/components/ui/table-cell";
import { colorRoles } from "../design-system";
import styles from "./style-guide.module.css";

export async function ColorRoleTable() {
  const t = await getTranslations("UI");
  const roles = colorRoles.filter((role) => ["background", "card", "foreground", "muted-foreground", "primary", "income", "destructive", "transfer", "warning"].includes(role.token));
  return <section className={styles.roleSummary} aria-labelledby="color-role-heading">
    <h2 id="color-role-heading">{t("styleGuidePalette")}</h2>
    <Table className={styles.roleTable} aria-labelledby="color-role-heading">
      <TableHeader><TableRow>
        <TableHead scope="col">{t("styleGuideRoleHeading")}</TableHead>
        <TableHead scope="col">{t("styleGuideLight")}</TableHead>
        <TableHead scope="col">{t("styleGuideDark")}</TableHead>
      </TableRow></TableHeader>
      <TableBody>{roles.map((role) => <TableRow key={role.token}>
        <TableHead scope="row">{t(role.label)}</TableHead>
        <TableCell><code>{role.light}</code></TableCell>
        <TableCell><code>{role.dark}</code></TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </section>;
}
